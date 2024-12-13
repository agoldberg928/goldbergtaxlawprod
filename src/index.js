console.log("running index.js")
import 'react-app-polyfill/stable';
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./css/styles.css";
import "./css/sortabletable.css";

require("./util/custom_typings/extensions")

import FileUploadApp from "./FileUploadApp";
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { msalConfig } from './auth/authConfig';


import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import Dashboard from './dashboard/Dashboard';
import { AppMSalWrapper } from './app';

// let app
// switch (window.location.pathname) {
//   case "/googlelogin": app = (<GoogleApiSignin />); break;
//   case "/": app = (<FileUploadApp />); break;
//   default: throw Error(`Path ${window.location.pathname} is invalid`)
// }

// handleRedirect().then(() =>{
//   const root = createRoot(document.getElementById("root"));
//   root.render(
//     <StrictMode>
//       <FileUploadApp />
//     </StrictMode>
//   );
// })

/**
 * MSAL should be instantiated outside of the component tree to prevent it from being re-instantiated on re-renders.
 * For more, visit: https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-react/docs/getting-started.md
 */
const msalInstance = new PublicClientApplication(msalConfig);

// Default to using the first account if no account is active on page load
if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
    // Account selection logic is app dependent. Adjust as needed for different use cases.
    msalInstance.setActiveAccount(msalInstance.getActiveAccount()[0]);
}

// Listen for sign-in event and set active account
msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload.account) {
        const account = event.payload.account;
        msalInstance.setActiveAccount(account);
    }
});


const root = createRoot(document.getElementById("root"));

function RoutedApp() {
  return (
      <BrowserRouter>
          <Routes>
              <Route index path="/" element={<AppMSalWrapper instance={msalInstance} appComponent={<FileUploadApp />} />} />
              <Route path="/dashboard" element={<AppMSalWrapper instance={msalInstance} appComponent={<Dashboard />} />} />
          </Routes>
      </BrowserRouter>
  );
}

root.render(
  <StrictMode>
    <RoutedApp />
  </StrictMode>
);