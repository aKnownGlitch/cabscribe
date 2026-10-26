# CabScribe

CabScribe is a personal, open-source desktop project for reading and writing
NMRA DCC decoder Configuration Variables (CVs). The planned initial hardware
target is a DCC-EX command station connected over a serial port, using
Service Mode programming.

> **Project status: early development.** The user interface, shared CV session
> state, and Electron serial-port connection shell are in place. DCC-EX CV
> commands have not yet been implemented or verified with hardware. CV read and
> write operations are intentionally unavailable; do not use this version to
> program a decoder.

## Planned features

- Discover and connect to a serial port from the desktop application.
- Read one decoder CV at a time in Service Mode.
- Review a CV write before confirming it.
- Verify a write by reading the CV back; never report success without a matching
  value.
- Report errors and uncertain outcomes explicitly, without automatically
  retrying writes.

## Technology and platform

- Angular desktop UI hosted by Electron.
- Chromium browser support through Web Serial on HTTPS or localhost, with an
  explicit device-permission chooser. Unsupported browsers cannot access serial
  ports.
- Serial-port access in Electron's main process, exposed to the UI through a
  restricted preload bridge.
- Initial package target: Debian `.deb` for Linux x64.
- macOS is currently a development and UI-testing environment, not a supported
  release target.

The Linux package target is configured but has not yet been verified on the
supported hardware and target distributions. See the
[implementation plan](docs/implementation-plan.md) for validation gates and
open work.

## Getting started

### Requirements

- Node.js 22 LTS and npm.
- Linux x64 for the configured desktop package target.
- A DCC-EX command station and compatible decoder for future hardware tests;
  this project version does not yet issue CV commands.

### Install dependencies

```sh
npm install
```

### Run the desktop shell

```sh
npx nx serve cabscribe-desktop
```

This builds the Angular renderer and launches the Electron application. The
serial port can be enumerated and opened, but the app does not yet communicate
with DCC-EX for CV operations.

To run the browser-based Angular UI with Web Serial:

```sh
npx nx serve cabscribe
```

Open the localhost URL in a Web Serial-capable Chromium browser (such as desktop
Chrome or Edge). In serial connection settings, click **Choose device**, grant
access to the command station, select the authorized port, and click **Connect**.
The browser opens it at 115200 baud and displays received bytes in the debug log.
Disconnect releases the port; unplugging it reports a connection error.

Device permission may persist according to browser settings, but a page can only
list ports authorized for its origin. Browser APIs do not expose a stable unique
hardware identifier: select the port again after reloading, rather than relying
on a saved Electron device path or matching ambiguous USB vendor/product IDs.
Another application must not already be using the port. Production hosting
requires HTTPS and must not block the `serial` Permissions Policy.

Browser and Electron builds currently have the same CV limitation: DCC-EX CV
commands are not implemented, so Read and Write remain disabled. Browser serial
behavior is covered by mocked API tests; physical-device testing is still needed.

### Build and test

```sh
npx nx run-many -t build,test,lint --projects=cabscribe,common
npx nx lint cabscribe-desktop
```

Create the configured Linux package with:

```sh
npx nx package cabscribe-desktop
```

Packaging and native serial dependency behavior have not yet been validated
end-to-end. See the project plan before treating generated packages as
releases.

## Project documentation

- [Product requirements](docs/prd.md)
- [Implementation plan](docs/implementation-plan.md)
- [UX design brief](docs/ux-design-brief.md)

## Safety and scope

CabScribe is intended to work with physical model railroad programming
equipment. Confirm the selected hardware and programming setup before
connecting. This development version has no verified CV protocol and must not
be relied on to read or change decoder settings.

The initial scope is one CV at a time in Service Mode. Operations Mode,
multi-CV workflows, saved operation history, and support for other command
stations are not currently included.

## Author and AI disclosure

CabScribe is a personal project authored by **Larry Weinheimer**. AI tools were
used during the development of this project, including assistance with
planning, documentation, and software implementation. The author is
responsible for reviewing and maintaining the project.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for the
full text. Third-party dependencies remain subject to their respective
licenses.

CabScribe is an independent project and is not affiliated with or endorsed by
the National Model Railroad Association (NMRA) or DCC-EX.
