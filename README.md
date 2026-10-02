# MP4MP3: Convert MP4 to MP3

## About The Project

<!--Screenshot here-->

A full stack TypeScript project that provides an easy way to convert MP4 files into MP3.

Born out of a desire to give my father a better conversion experience than "I'm sorry you have reached the free limit for conversions for today" asshole websites, and to mitigate slow uploads to said websites.

### Built With

- Express (for backend)
- React (for frontend)
- MinIO (for object storage)
- FFmpeg (for the conversion library)
- Docker (for deployment platform)

## Getting Started

### Prerequisites

- Node: https://nodejs.org/en/download
- FFmpeg
- act: from `brew install act`
- Docker
    - Linux: https://docs.docker.com/engine/install/
    - Other OSes: https://docs.docker.com/desktop/

### Installation

```sh
    npm install
```

## Usage

There are 3 components to this entire repo:

- MinIO server
- The React/Vite website in `/frontend`
- The Express server in `/backend`

### MinIO server

The frontend needs the backend up and running to work, and the backend needs the MinIO server up and running to work. Therefore, in local development, it is required to have the MinIO server running in a Docker container at all times. Use the following command to start a local MinIO server:

```
docker compose up -d minio

# To shut down
docker compose down minio
```

Alternatively, if you have a S3 compatabile server of your own, modify the following enviroment variables in `.env` at your own discretion. Usually using a local MinIO Docker container is easier. Read the .env file to see more info on these values

```
MINIO_SERVER_URL=http://localhost:9000
PUBLIC_S3_ENDPOINT=http://localhost:9000
INTERNAL_S3_ENDPOINT=http://minio:9000
```

### React/Vite website in `/frontend`

For most development purposes, it is highly advisable to just run (from root folder):

```
npm run dev --workspace=frontend
```

Alternatively, the manual (and more involved) process would be to build and deploy to a bucket in MinIO, and spin up a nginx Docker pointing towards that bucket. The commands are as follows:

```
npm run build --workspace=frontend
npm run deploy --workspace=frontend
docker compose up -d web

# To shutdown
docker compose down web
```

### Express server in `/backend`

Unlike the frontend,it is highly advised to continuously rebuild the Docker container, as the default env file points certain logic to MinIO's Docker network IP. The command is as follows:

```
docker compose up -d mp4mp3
```

Alternatively, if you've changed the enviroment variables for MinIO server IP in `.env`, you can run the following (from root folder):

```
npm run dev --workspace=backend
```


## License

Distributed under GNU AGPLv3. See `LICENSE.txt` for more information.

## Contact

Johnny - jmlin0101@gmail.com

## Acknowledgments
