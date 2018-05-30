// This file is required by karma.conf.js and loads recursively all the .spec and framework files

window.onerror = (evt: any) => console.error(evt.error);

// tslint:disable
import 'zone.js/dist/long-stack-trace-zone';
import 'zone.js/dist/proxy';
import 'zone.js/dist/sync-test';
import 'zone.js/dist/mocha-patch';
import 'zone.js/dist/async-test';
import 'zone.js/dist/fake-async-test';
import 'zone.js/dist/zone-patch-promise-test';

import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

declare const require: any;

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
// Then we find all the tests.
const context = require.context('./', true, /\.spec\.ts$/);
// And load the modules.
context.keys().map(context);
