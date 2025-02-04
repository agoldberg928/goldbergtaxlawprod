import { deleteCookie, getCookie, setCookie, STATIC_COOKIE_KEYS } from "./CookieWrapper";
import { CsvSummary } from "./AzureStorageClientWrapper";
import { jwtDecode } from "jwt-decode";

export interface GoogleAccount {
  name: string,
  email: string
}

class GoogleApiClient {
  constructor() {
    // this dirty hack to load Google APIs and Google Identity Services because I cannot for the life of me make using it through npm work
    const gapiScript = document.createElement('script');
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.async = true;
    gapiScript.onload = this.onGapiLoaded.bind(this)
    document.body.appendChild(gapiScript);
    
    const otherScript = document.createElement('script');
    otherScript.src = "https://accounts.google.com/gsi/client";
    otherScript.async = true;
    otherScript.onload = this.onGisLoaded.bind(this)
    document.body.appendChild(otherScript);
  }

  private initCallbacks: Array<(signedInUser: GoogleAccount | undefined) => void> = []
  
  static CLIENT_ID = '337640530335-85k0ifb0bq4mm63qungn860fm67bniir.apps.googleusercontent.com';
  static API_KEY = 'AIzaSyDg8UhNO0hCyeS2Vij-4ziAVZAv7JldkqY';

  // Discovery doc URL for APIs used by the quickstart
  static DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

  // Authorization scopes required by the API; multiple scopes can be
  // included, separated by spaces.
  static SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

  private gapiInited = false
  private gisInited = false
  signedInUser: GoogleAccount | undefined

  /**
  * Callback after api.js is loaded. Loads the API client and then afterwards
  * Loads the discovery doc to initialize the API.
  */
  private onGapiLoaded() {
    gapi.load('client', (async () => {
        await gapi.client.init({
            apiKey: GoogleApiClient.API_KEY,
            discoveryDocs: [GoogleApiClient.DISCOVERY_DOC],
        });
        this.gapiInited = true
        this.tryInit()
    }).bind(this));
  }

  /**
  * Callback after Google Identity Services are loaded.
  */
  private onGisLoaded() {
    this.gisInited = true;
    this.tryInit()
  }

  private tryInit() {
    if (this.gapiInited && this.gisInited) {
      const googleToken = getCookie(STATIC_COOKIE_KEYS.GOOGLE_SESSION_TOKEN)
      if (googleToken) {
        gapi.client.setToken({access_token: googleToken})
        this.signedInUser = {
          name: getCookie(STATIC_COOKIE_KEYS.GOOGLE_USER_NAME)!,
          email: getCookie(STATIC_COOKIE_KEYS.GOOGLE_USER_EMAIL)!
        }
      } 
      const client = this
      this.initCallbacks.forEach((callback) => callback(client.signedInUser))
    }

  }

  // to ensure that anyone waiting for the scripts to load can refresh once it's inited
  refreshOnInit(callback: (signedInUser: GoogleAccount | undefined) => void) {
    if (this.gapiInited && this.gisInited) {
      callback(this.signedInUser)
    } else {
      this.initCallbacks.push(callback)
    }
  }

  private async fetchUserData(token: string): Promise<GoogleAccount> {
    const userData: any = await fetch('https://www.googleapis.com/userinfo/v2/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => { return data })
    .catch(error => { console.error('Error fetching user profile:', error);
});

    return {
      name: userData.name,
      email: userData.email
    }
  }

  private async tokenClientSigninCallback(resp: google.accounts.oauth2.TokenResponse, callback: (signedInUser: GoogleAccount) => void) {
    if (resp.error !== undefined) {
      throw (resp);
    }

    const token = resp.access_token

    this.signedInUser = await this.fetchUserData(token)

    setCookie(STATIC_COOKIE_KEYS.GOOGLE_SESSION_TOKEN, token, Number(resp.expires_in))
    setCookie(STATIC_COOKIE_KEYS.GOOGLE_USER_EMAIL, this.signedInUser.email, Number(resp.expires_in))
    setCookie(STATIC_COOKIE_KEYS.GOOGLE_USER_NAME, this.signedInUser.name, Number(resp.expires_in))
    callback(this.signedInUser!)
  }

  /**
   *  Sign in the user upon button click.
   */
  signIn(callback: (signedInUser: GoogleAccount) => void) {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GoogleApiClient.CLIENT_ID,
      scope: GoogleApiClient.SCOPES,
      callback: ((resp: google.accounts.oauth2.TokenResponse) => {
        this.tokenClientSigninCallback(resp, callback)
      }).bind(this)
    });

    if (this.signedInUser) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
      // Skip display of account chooser and consent dialog for an existing session.
      tokenClient.requestAccessToken({prompt: ''});
    }
  }

  /**
  *  Sign out the user upon button click.
  */
  signOut(callback: () => void) {
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token, (() => {
        gapi.client.setToken({access_token: ''});
        deleteCookie(STATIC_COOKIE_KEYS.GOOGLE_SESSION_TOKEN)
        deleteCookie(STATIC_COOKIE_KEYS.GOOGLE_USER_NAME)
        deleteCookie(STATIC_COOKIE_KEYS.GOOGLE_USER_EMAIL)
        this.signedInUser = undefined
      }).bind(this));
      callback()
    }
  }

  async createGoogleSpreadSheet(sheetTitle: string, csvFiles: CsvSummary) {
    if (!this.signedInUser) {
      throw Error("Please sign in to google in order to create a spreadsheet")
    }
    try {
      // const response = await gapi.client.sheets.spreadsheets.get({
      //   spreadsheetId: '13NFHg1_Dr9ahtPoMk2yom0l9xspiaIwzvrUsYziOgI0',
      // });

      const response = await gapi.client.sheets.spreadsheets.create({
        resource: {
          properties: {
            title: sheetTitle
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
}

export const GOOGLE_API_WRAPPER = new GoogleApiClient()
