import { IPublicClientApplication } from '@azure/msal-browser';
import { MsalProvider, AuthenticatedTemplate, useMsal, UnauthenticatedTemplate } from '@azure/msal-react';
import { Button } from '@mui/material';
import React from 'react';

interface WrapperProps {
    instance: IPublicClientApplication,
    appComponent: React.ReactNode
}

export function AppMSalWrapper({instance, appComponent}: WrapperProps) {
    return (
      <MsalProvider instance={instance}>
        <App appComponent={ appComponent } />
      </MsalProvider>
    )
}

function App({appComponent}: any) {
  const msal = useMsal()
  const activeAccount = msal.instance.getActiveAccount();

  const handleRedirect = () => {
      // @ts-ignore
      msal.instance.loginRedirect({...loginRequest, prompt: 'create',})
          .catch((error) => console.log(error));
  };

  return (
    <>
        <UnauthenticatedTemplate>
            <Button className="signInButton" onClick={handleRedirect} color='primary' variant="contained"> Sign in </Button>
        </UnauthenticatedTemplate>
    </>
  )
}