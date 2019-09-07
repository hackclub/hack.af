# Hack Club's Airtable Based Link Shortener

## Setup

* Please make a copy of the template AirTable Base: [https://go.mingjie.info/template](https://go.mingjie.info/template)
* Please also grab the AirTable API Key & Base Key from the API documentations. Head [here](https://airtable.com/api) and click on the base you just created to get started.
* Set `AIRTABLE_BASE` to your Base Key, and `AIRTABLE_KEY` to your API Key.
* Set `APP_USER` to your desired username.
* Set `APP_SECRET` to a passphrase or key that only you know.
* Set `LOGGING` to `on` if you want to enable logging, `off` if otherwise.
* Set `ROOT_REDIRECT` to the URL you want people to be redirected to when they visit the landing page.

## Using

All links will be routed through a 302 (Temporary Redirect) because you're using AirTable. Simply visit `example.com/slug` to get redirected.

## No API?

I'm insecure about my ability to write software with great security measures, therefore all components originally written as the API has been removed for this distribution. 

If API access is needed, please invent your own wheel with AirTable API. See implementation example at https://go.mingjie.info/code.

## License

This project is released under [the MIT license](LICENSE).