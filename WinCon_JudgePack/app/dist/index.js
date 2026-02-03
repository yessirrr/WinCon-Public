#!/usr/bin/env node
import { jsx as _jsx } from "react/jsx-runtime";
import 'dotenv/config';
import { render } from 'ink';
import { App } from './App.js';
// Clear console and render app - no preloading, data fetched on-demand
console.clear();
const { waitUntilExit } = render(_jsx(App, {}));
waitUntilExit().then(() => {
    console.log('Thanks for using WinCon!');
});
