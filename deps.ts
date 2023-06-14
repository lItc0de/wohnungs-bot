export * as path from 'https://deno.land/std@0.177.1/path/mod.ts';
export * as sqlite from 'https://deno.land/x/sqlite@v3.7.2/mod.ts';
export { default as puppeteer, type Browser, type Page, type ElementHandle } from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';
export { type LaunchOptions } from 'https://deno.land/x/puppeteer@16.2.0/src/deno/LaunchOptions.ts';
export { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

import { config } from 'https://deno.land/x/dotenv@v3.2.2/mod.ts';
export const env = config();
