# hack.af

> [Hack Club](https://hackclub.com)’s Airtable-Based Link Shortener

## Setup

* Please make a copy of the template Airtable Base: [https://go.mingjie.info/template](https://go.mingjie.info/template)
* Please also grab the Airtable API Key & Base Key from the API documentations. Head [here](https://airtable.com/api) and click on the base you just created to get started.
* Set `AIRTABLE_BASE` to your Base Key, and `AIRTABLE_KEY` to your API Key.
* Set `LOGGING` to `on` if you want to enable logging, `off` if otherwise.
* Set `BOT_LOGGING` to `on` if you want to enable logging for crawlers, `off` if otherwise.
* Set `CACHE_EXPIRATION` to the number of seconds you want the local cache to be valid.

## Using

All links will be routed through a 302 (Temporary Redirect) because you're using Airtable. Simply visit `example.com/slug` to get redirected.

## No API?

I'm insecure about my ability to write software with great security measures, therefore all components originally written as the API has been removed for this distribution. 

If API access is needed, please invent your own wheel with Airtable API. See implementation example at https://go.mingjie.info/code.

## License

This project is released under [the MIT license](LICENSE).
