import { IPublicClientApplication } from '@azure/msal-browser';
import { MsalProvider, AuthenticatedTemplate, useMsal, UnauthenticatedTemplate } from '@azure/msal-react';
import { loginRequest } from './auth/authConfig';
import { Button } from '@mui/material';
import React from 'react';
import AppSkeleton from './appskeleton/AppSkeleton';
import { Provider } from 'react-redux';
import store from './store';


interface WrapperProps {
    instance: IPublicClientApplication,
    children: React.ReactNode,
}

export function AppMSalWrapper({instance, children}: WrapperProps) {
    return (
      <MsalProvider instance={instance}>
          <MSalApp>
            {children}
          </MSalApp>
      </MsalProvider>
    )
}

function MSalApp({children}: {children: React.ReactNode}) {
  const msal = useMsal()

  const handleRedirect = () => {
      // @ts-ignore
      msal.instance.loginRedirect({...loginRequest, prompt: 'create',})
          .catch((error) => console.log(error));
  };

  return (
    <>
        <AuthenticatedTemplate>
          <App>{children}</App>
        </AuthenticatedTemplate>
        <UnauthenticatedTemplate>
            {/* TODO: make this fancier */}
            <Button className="signInButton" onClick={handleRedirect} color='primary' variant="contained"> Sign in </Button>
        </UnauthenticatedTemplate>
    </>
  )
}

function App({children}: {children: React.ReactNode}) {
  return (
    <Provider store={store}>
      <AppSkeleton>
        {children}
      </AppSkeleton>
    </Provider>
  );
}