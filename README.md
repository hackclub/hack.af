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

## Dashboard

Staff manage links at `manage.hack.club`: create and edit links, see click history and change history, and control who has access. It's a [Remix 3](https://remix.run) app in `manage/`, served by the same Express process for requests on `MANAGE_HOST`.

To work on it locally:

1. Seed a local database with demo data (refuses to run against a non-local `DATABASE_URL`):

   ```fish
   bun run db:dev
   ```

2. Add to `.env`:

   ```
   MANAGE_DEV_LOGIN=1
   MANAGE_DEV_LOGIN_AS=U0ORPHEUS1
   ```

3. Run `bun dev` and open [http://manage.localhost:3000](http://manage.localhost:3000).

In production, sign-in uses Hack Club Auth. Access is the `staff` table, which the Slack bot's staff-only commands also use. See `.env.example` for the variables.

## Usage

All links are routed through a 302 (Temporary Redirect). Simply visit `hack.af/slug` to get redirected. 404's are pointed to `hackclub.com/404`.

## License

This project is released under [the MIT license](LICENSE).
