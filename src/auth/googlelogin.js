import { Login, Logout, Refresh } from "@mui/icons-material";
import { Button } from "@mui/material";
import React, { useEffect, useState } from "react";
import { CookieKey, deleteCookie, getCookie, setCookie } from "../client/cookieClient";

export function GoogleApiSignin() {
  useEffect(() => {
    // this dirty hack to load Google APIs and Google Identity Services because I cannot for the life of me make using it through npm work
    const gapiScript = document.createElement('script');
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.async = true;
    gapiScript.onload = gapiLoaded
    document.body.appendChild(gapiScript);
    
    const otherScript = document.createElement('script');
    otherScript.src = "https://accounts.google.com/gsi/client";
    otherScript.async = true;
    otherScript.onload = gisLoaded
    document.body.appendChild(otherScript);
  
    return () => {
      document.body.removeChild(gapiScript);
      document.body.removeChild(otherScript);
    }
  }, []);
  
  const CLIENT_ID = '337640530335-85k0ifb0bq4mm63qungn860fm67bniir.apps.googleusercontent.com';
  const API_KEY = 'AIzaSyDg8UhNO0hCyeS2Vij-4ziAVZAv7JldkqY';

  // Discovery doc URL for APIs used by the quickstart
  const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

  // Authorization scopes required by the API; multiple scopes can be
  // included, separated by spaces.
  const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

  const [tokenClient, setTokenClient] = useState(undefined)
  const [gapiInited, setGapiInited] = useState(false)
  const [gisInited, setGisInited] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  
  if (gapiInited && gisInited && !isSignedIn) {
    const googleToken = getCookie(CookieKey.GOOGLE_SESSION_TOKEN)
    if (googleToken) {
      gapi.client.setToken({access_token: googleToken})
      setIsSignedIn(true)
    } 
  }

  /**
  * Callback after api.js is loaded.
  */
  function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
  }

  /**
  * Callback after the API client is loaded. Loads the
  * discovery doc to initialize the API.
  */
  async function initializeGapiClient() {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });
    setGapiInited(true)
  }

  /**
  * Callback after Google Identity Services are loaded.
  */
  function gisLoaded() {
    setTokenClient(google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: tokenClientCallback, // defined later
    }));
    setGisInited(true);
  }

  async function tokenClientCallback(resp) {
    if (resp.error !== undefined) {
      throw (resp);
    }
    setIsSignedIn(true)
    const token = gapi.client.getToken()
    setCookie(CookieKey.GOOGLE_SESSION_TOKEN, token.access_token, Number(token.expires_in))
  }

  /**
   *  Sign in the user upon button click.
   */
  function handleAuthClick() {
    if (isSignedIn) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      tokenClient?.requestAccessToken({prompt: 'consent'});
    } else {
      // Skip display of account chooser and consent dialog for an existing session.
      tokenClient?.requestAccessToken({prompt: ''});
    }
  }

  /**
  *  Sign out the user upon button click.
  */
  function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken({access_token: ''});
      deleteCookie(CookieKey.GOOGLE_SESSION_TOKEN)
      setIsSignedIn(false)
    }
  }

  return (
    <div>
      {isSignedIn ?
        <>
          <Button variant="outlined" startIcon={<Refresh /> } color="primary" id="authorize_button" onClick={() => handleAuthClick()}>
            Refresh Credentials
          </Button>
          <Button variant="outlined" startIcon={<Logout />} id="signout_button" onClick={() => handleSignoutClick()}>
            Sign Out from Google
          </Button>
        </>
        :
          <Button variant="outlined" startIcon={<Login /> } color="primary" id="refresh_button" onClick={() => handleAuthClick()}>
            Sign in to Google
          </Button>
      }
    </div>
  )
}

export async function createGoogleSpreadSheet(csvFiles) {
  try {
    // const response = await gapi.client.sheets.spreadsheets.get({
    //   spreadsheetId: '13NFHg1_Dr9ahtPoMk2yom0l9xspiaIwzvrUsYziOgI0',
    // });

    const response = await gapi.client.sheets.spreadsheets.create({
      resource: {
        properties: {
          title: "My Google Sheet"
        },
        sheets: [
          {
            properties: {
              title: "Records",
              gridProperties: {
                frozenRowCount: 1,
                frozenColumnCount: 1
              }
            }
          },
          {
            properties: {
              title: "Account Summary",
              gridProperties: {
                frozenRowCount: 1,
                frozenColumnCount: 1
              }
            }
          },
          {
            properties: {
              title: "Statement Summary",
              gridProperties: {
                frozenRowCount: 1,
                frozenColumnCount: 1
              }
            }
          },
          {
            properties: {
              title: "Check Summary",
              gridProperties: {
                frozenRowCount: 1,
                frozenColumnCount: 1
              }
            }
          }
        ]
      }
    })

    const responseObj = JSON.parse(response.body)

    const spreadsheetId = responseObj.spreadsheetId
    
    console.log(`created spreadsheet ${spreadsheetId}`)

    const recordsSheetId = responseObj.sheets[0].properties.sheetId

    // the create API can't create a sheet using csv data and it can't do things like set a whole row to bold, 
    // you have to do it in batch updates
    const updateResponse = await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: {
        requests: [
          {
            // paste record data
            pasteData: {
              coordinate: {
                sheetId: recordsSheetId,
                rowIndex: 0,
                columnIndex: 0
              },
              data: csvFiles.records,
              delimiter: ","
            }
          },
          {
            // paste account summary data
            pasteData: {
              coordinate: {
                sheetId: responseObj.sheets[1].properties.sheetId,
                rowIndex: 0,
                columnIndex: 0
              },
              data: csvFiles.accountSummary,
              delimiter: ","
            }
          },
          {
            // paste statement summary data
            pasteData: {
              coordinate: {
                sheetId: responseObj.sheets[2].properties.sheetId,
                rowIndex: 0,
                columnIndex: 0
              },
              data: csvFiles.statementSummary,
              delimiter: ","
            }
          },
          {
            // paste check summary data
            pasteData: {
              coordinate: {
                sheetId: responseObj.sheets[3].properties.sheetId,
                rowIndex: 0,
                columnIndex: 0
              },
              data: csvFiles.checkSummary,
              delimiter: ","

            }
          },
          {
            // (Records) Bold the entire first row
            repeatCell: {
              range: {
                sheetId: recordsSheetId,
                startRowIndex: 0,
                endRowIndex: 1
              },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat.bold"
            }
          },
          {
            // (Records) Bold the entire first column
            repeatCell: {
              range: {
                sheetId: recordsSheetId,
                startColumnIndex: 0,
                endColumnIndex: 1
              },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat.bold"
            }
          },
          {
            // (Records) Format the first column as a date
            repeatCell: {
              range: {
                sheetId: recordsSheetId,
                startColumnIndex: 0,
                endColumnIndex: 1
              },
              cell: { userEnteredFormat: { numberFormat: { type: "DATE" } } },
              fields: "userEnteredFormat.numberFormat"
            }
          },
          {
            // (Records) Format the 3rd column as currency
            repeatCell: {
              range: {
                sheetId: recordsSheetId,
                startColumnIndex: 2,
                endColumnIndex: 3
              },
              cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY" } } },
              fields: "userEnteredFormat.numberFormat"
            }
          },
          {
            // (Records) Format the 7th column as a date
            repeatCell: {
              range: {
                sheetId: recordsSheetId,
                startColumnIndex: 6,
                endColumnIndex: 7
              },
              cell: { userEnteredFormat: { numberFormat: { type: "DATE" } } },
              fields: "userEnteredFormat.numberFormat"
            }
          }
        ]
      }
    })
    console.log("applied formatting")
    return spreadsheetId
  } catch (err) {
    console.log(err)
    // code = 401 for unauthorized const error = JSON.parse(temp1.body).error (.code, .message, .status)
    throw err
  }
}

// sheets: [
//   // records
//   {
    // properties: {
      // title: "Test Spreadsheet",
      // gridProperties: {
      //   frozenRowCount: 1,
      //   frozenColumnCount: 1
      // }
    // },
//     data: [
//       {
//         columnMetadata: [
//           {}
//         ],
//         rowData: [
//           {
//             values: [
//               {userEnteredValue: {stringValue: "9/1/2020"}},
//               {userEnteredValue: {stringValue: "Test1"}},
//               {userEnteredValue: {numberValue: 2.5}},
//               {userEnteredValue: {stringValue: "Test3"}},
//               {userEnteredValue: {stringValue: "Test4"}},
//               {userEnteredValue: {stringValue: "Test5"}},
//               {userEnteredValue: {stringValue: "9/8/2020"}}
//             ]
//           },
//           {
//             values: [
//               {userEnteredValue: {stringValue: "9/2/2021"}},
//               {userEnteredValue: {stringValue: "Yo1"}},
//               {userEnteredValue: {stringValue: "Yo2"}},
//               {userEnteredValue: {stringValue: "Yo3"}},
//               {userEnteredValue: {stringValue: "Yo4"}},
//               {userEnteredValue: {stringValue: "Yo5"}},
//               {userEnteredValue: {stringValue: "9/8/2021"}}
//             ]
//           },
//           {
//             values: [
//               {userEnteredValue: {numberValue: 100}},
//               {userEnteredValue: {numberValue: 100}},
//               {userEnteredValue: {numberValue: 100}},
//               {userEnteredValue: {numberValue: 100}},
//               {userEnteredValue: {numberValue: 100}}
//             ]
//           }
//         ],
//         rowMetadata: [
//           {}
//         ]
//       }
//     ]
//   }
// ]


// requests: [
//   {
//     addConditionalFormatRule: {
//       rule: {
//         // bold the first row and column
//         ranges: [
//           {sheetId: recordsSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0},
//           {sheetId: recordsSheetId, startRowIndex: 0, endColumnIndex: 1, startColumnIndex: 0}
//         ],
//         booleanRule: {condition: {type: "NOT_BLANK"}, format: {textFormat: {bold: true}}}
//       }
//     }
//   },
  // {
  //   addConditionalFormatRule: {
  //     rule: {
  //       // format 3rd column as currency
  //       ranges: [
  //         {sheetId: recordsSheetId, startRowIndex: 0, endColumnIndex: 3, startColumnIndex: 2}
  //       ],
  //       booleanRule: {condition: {type: "NOT_BLANK"}, format: {numberFormat: {type: "CURRENCY"}}}
  //     }
  //   }
  // },
  // {
  //   // format 1st and 7th column as date
  //   addConditionalFormatRule: {
  //     rule: {
  //       ranges: [
  //         {sheetId: recordsSheetId, startRowIndex: 0, endColumnIndex: 1, startColumnIndex: 0},
  //         {sheetId: recordsSheetId, startRowIndex: 0, endColumnIndex: 7, startColumnIndex: 6}
  //       ],
  //       booleanRule: {condition: {type: "NOT_BLANK"}, format: {numberFormat: {type: "DATE"}}}
  //     }
  //   }
  // }
// ],