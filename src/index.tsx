#!/usr/bin/env node
import 'dotenv/config';
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

// Clear console and render app - no preloading, data fetched on-demand
console.clear();

const { waitUntilExit } = render(<App />);

waitUntilExit().then(() => {
  console.log('Thanks for using WinCon!');
});
