<div align="center">
<img src="./public/favicon.ico" alt="hack.af logo" width="100" height="100">
<h1>hack.af</h1>
<a href="https://hackclub.com">Hack Club</a>’s Link Shortener
</div>

## Quick Start (Development)

1. Clone the repository:

    ```fish
    git clone https://hackclub.com/hackclub/hack.af.git
    cd hack.af
    ```

2. Install dependencies:

    ```fish
    bun i
    ```

3. Clone `.env.example` to `.env` and fill in the required environment variables.

4. Start the postgres db:

    ```fish
    bun run docker-dev
    ```

5. Start the development server!

    ```fish
    bun dev
    ```

## Usage

All links are routed through a 302 (Temporary Redirect). Simply visit `hack.af/slug` to get redirected. 404's are pointed to `hackclub.com/404`.

## License

This project is released under [the MIT license](LICENSE).
