# Via

<img src="/assets/logo.png" alt="via logo" style="height: 100px; width:100px;"/>

Road quality assessment from bike and vehicle journeys, tools to analyse data collected from the android app https://github.com/RobertLucey/road-quality-aggregator

## Usage

Run the development site `http://localhost:8080` against the local API at `http://api.localhost:8080`:

```sh
docker compose up dev --build
```

Run the site against the production API:

```sh
docker compose up prod --build
```

To run the frontend against an API, override its URL:

```sh
docker compose run --rm --build --service-ports -e VUE_APP_API_URL=https://api.viaroads.com dev
```

Replace the URL with your local API address when developing the backend.
