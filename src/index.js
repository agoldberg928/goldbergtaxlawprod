import React, { StrictMode } from "react";
import 'react-app-polyfill/stable';
import { createRoot } from "react-dom/client";
import "./css/loading.css";
import "./css/sortabletable.css";
import "./css/styles.css";

require("./util/custom_typings/extensions")

import { EventType, PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './auth/authConfig';
import FileUploadApp from "./pages/file_upload/FileUploadApp";


import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppMSalWrapper } from './app';
import StatementsDashboard from './pages/statements/StatementsDashboard';
import { StatementDetails } from "./pages/statementDetails/StatementDetails";
import ApiHelperApp from "./pages/api_helper/ApiHelperApp";

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
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
        const account = event.payload?.account;
        msalInstance.setActiveAccount(account);
    }
});


const root = createRoot(document.getElementById("root"));

function RoutedApp() {
  return (
      <BrowserRouter basename={process.env.REACT_APP_BASE_PATH}>
          <Routes>
              <Route index path="/" element={<FileUploadApp />} />
              <Route path="/dashboard" element={<StatementsDashboard /> } />
              <Route path="/statement" element={<StatementDetails stmtId={new URL(window.location).searchParams.get("stmtId") || "invalid"} /> } />
              <Route path="/api" element={<ApiHelperApp /> } />
          </Routes>
      </BrowserRouter>
  );
}

document.title = `${window.location.pathname.replace("/", "").capitalize()} - ${document.title}`

root.render(
  <StrictMode>
    <AppMSalWrapper instance={msalInstance}>
        <RoutedApp />
    </AppMSalWrapper>
  </StrictMode>
);