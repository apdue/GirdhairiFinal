# Facebook Lead Forms Manager

A modern web application for efficiently managing and downloading Facebook lead form data.

## Features

- Connect to multiple Facebook accounts
- View and select pages associated with each account
- Browse lead forms for each page
- Filter leads by date range (today, yesterday, all, custom)
- Download leads in Excel or CSV format
- Preview leads with pagination
- Modern, responsive UI built with Next.js and Tailwind CSS

## Deployment to Vercel

### Prerequisites

- A Vercel account
- A GitHub account (with this repository)

### Deployment Steps

1. Fork or clone this repository to your GitHub account
2. Log in to your Vercel account
3. Click "New Project"
4. Import your GitHub repository
5. Configure the following environment variables in the Vercel dashboard:
   - `NEXT_PUBLIC_FACEBOOK_API_VERSION`: v19.0 (or your preferred version)
   - `NEXT_PUBLIC_APP_URL`: Your Vercel app URL (e.g., https://leadmanager.vercel.app)

6. Deploy the application

### Post-Deployment Configuration

After deployment, you'll need to:

1. Set up your Facebook accounts in the application
2. Add your Facebook App ID and App Secret
3. Generate and add your Facebook access tokens

## Local Development

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Build for production
npm run build

# Start the production server
npm start
```

## Technologies Used

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Facebook Graph API

## License

MIT
