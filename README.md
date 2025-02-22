# Circle Modular Wallets - Setup Guide

## Overview

This guide will walk you through setting up a Circle Developer Console account, creating a client key for web, configuring the passkey server for localhost, and obtaining the client URL to integrate with your app.

## Create a Circle Developer Console Account

1. Visit the [Circle Developer Console](http://console.circle.com/).
2. Sign up or log in with your credentials.

## Generate a Client Key for Web

1. In the Developer Console, go to API & Client Keys.
2. Click on Client Keys Tab.
3. Click on Create a key button and choose Client Key.
4. Add Key Name and enter the value of localhost in the Allowed Domain field of Web.

## Configure the Passkey Server for Localhost

1. In the Circle Developer Console, navigate to the Modular Wallets section on the left sidebar.
2. Click on Configurator.
3. Configure your application's domain. In this case, set it to localhost.
4. Once configured, copy the Client URL from the Configurator screen.

## Set Up Environment Variables

1. Create a .env file in your project root and add:

```bash
NEXT_PUBLIC_CLIENT_KEY=<your-client-key>
NEXT_PUBLIC_CLIENT_URL=<your-client-url>
```
## Install and Run the Application
```bash
npm install
npm run dev
```
Once the application starts, open your browser and go to:
```bash
http://localhost:3000
```
