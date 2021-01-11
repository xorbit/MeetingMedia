# Meeting Media

[Node.js](https://nodejs.org/) script to scrape images for various meeting parts from the [Watchtower Online Library](https://wol.jw.org/).

## Installation

Developed on Linux, but likely can be made to work on MacOS and Windows as well.

Download the package with `git` by running:

```sh
git clone https://github.com/xorbit/MeetingMedia.git
```

Or download the ZIP from the Code dropdown.

Install the package dependencies by running:

```sh
npm install
```

in the project directory.

## Usage

Download the media for the current week by running:

```sh
node GetMeetingMedia.js
```

The media are downloaded in the current directory, so you may not want to run this in the project's directory unless you like making a mess.  Instead make a directory for the media, and run the command from there.  An example of how to do that, embedded in a script that first removes old media and then calls the script, can be found in `00. Get Meeting Media`, which I made to live in the media directory.
