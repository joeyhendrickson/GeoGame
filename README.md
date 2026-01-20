# GeoGame Research

An intelligent FAQ and advisory application for Blackboard Ultra content management, powered by OpenAI GPT-4o-mini, Pinecone vector database, and Google Drive integration.

## Features

- **AI Chat Interface**: Interactive FAQ and advisory system using GPT-4o-mini
- **Vector Database**: Pinecone integration for semantic search across indexed documents
- **Google Drive Integration**: OAuth 2.0 authentication for accessing and processing documents
- **Document Processing**: Upload project management templates and automatically fill them with relevant information from the knowledge base
- **Document Download**: Export completed documents with a single click

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.local.example` to `.env.local` and fill in your credentials:
```bash
cp .env.local.example .env.local
```

3. Configure your environment variables (see `.env.local.example` for details)

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

See `.env.local.example` for all required environment variables.

**For detailed Google OAuth 2.0 setup instructions**, see [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)

**To connect your Google Drive**, see [CONNECT_GOOGLE_DRIVE.md](./CONNECT_GOOGLE_DRIVE.md) - or use the "Google Drive Setup" tab in the application!

## Deployment

This application is configured for deployment on Vercel. Make sure to set all environment variables in your Vercel project settings.

## Project Structure

- `/app` - Next.js app router pages and components
- `/lib` - Utility functions and integrations (Pinecone, OpenAI, Google Drive)
- `/components` - React components
- `/api` - API routes for backend functionality

