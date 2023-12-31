# Timekeeper Readonly

Simple Web frontend using Earthstar showing the user status and some of the last
journal entries.

<https://earthstar-project.org/docs/>

The JavaScript code is deliberately kept basic, no frameworks.

## Guidelines

Code is formatted using "deno fmt".

## Start

    npx live-server .

## Requirements

- Node/NPM/NPX
- A running Earthstar peer replica server

## Plan

In no particular order.

- [ ] Add `displayName` so it is clear who's data we're seeing.
- [x] Add nicer "loading" display for the initial data loading.
- [x] Add custom prompts for asking for server and share address.
- [ ] Render Time Reports and Timesheet.
- [x] Clean up the source code with better structuring.
- [ ] Journal: Add pagination to the "Journal".
- [ ] Journal: Allow for period filtering.
- [ ] Status: show timestamp of last status update.
- [x] Organise the journal entries by day.

## Build Command

    cp src/* public/

## Deploy

    fly deploy --remote-only
