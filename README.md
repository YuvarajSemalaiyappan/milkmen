# Milkmen - Milk Collection & Sales Management PWA

A Progressive Web App for milkmen to manage daily milk collection from farmers and sales to customers. Works offline in rural areas and supports English & Tamil.

## Project Structure

```
milkmen/
├── apps/
│   ├── mobile-web/          # Main PWA (React + TypeScript + Tailwind)
│   └── admin-panel/         # Admin Panel (TODO)
├── server/                  # Backend API (Express + Prisma + PostgreSQL)
├── packages/
│   └── shared/             # Shared types and utilities
└── package.json            # Root package.json (workspaces)
```

## Tech Stack

### Frontend (apps/mobile-web)
- React 18 + TypeScript
- Tailwind CSS
- Zustand (state management)
- Dexie.js (IndexedDB for offline)
- Vite + PWA plugin
- react-i18next (English + Tamil)
- React Router

### Backend (server)
- Node.js + Express
- Prisma ORM
- PostgreSQL
- JWT authentication
- bcrypt (PIN hashing)

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
# Install root dependencies
npm install

# Install mobile-web dependencies
cd apps/mobile-web
npm install

# Install server dependencies
cd ../../server
npm install
```

### Database Setup

1. Create a PostgreSQL database
2. Copy `.env.example` to `.env` in the server folder:

```bash
cd server
cp .env.example .env
```

3. Update the `DATABASE_URL` in `.env`
4. Generate Prisma client and push schema:

```bash
npm run db:generate
npm run db:push
```

### Running the App

#### Development

```bash
# Run frontend only
npm run dev

# Run server only
npm run dev:server

# Run both (requires concurrently)
npm run dev:all
```

#### Production

```bash
# Build frontend
npm run build

# Build and start server
npm run build:server
npm run start:server
```

## Features

- **Offline-First**: Works without internet, syncs when online
- **Multi-language**: English and Tamil support
- **PWA**: Install as native app on mobile devices
- **Role-based Access**: Owner, Manager, Staff roles
- **Subscription Management**: Monthly/Quarterly/Annual plans

### Core Modules
- Dashboard with daily stats
- Farmer management with collection tracking
- Customer management with subscriptions
- Milk collection (purchase from farmers)
- Milk delivery (sales to customers)
- Payment tracking (both sides)
- Reports with export options

## Environment Variables

### Server (.env)
```
DATABASE_URL=postgresql://...
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your-jwt-secret
SETUP_SECRET=your-setup-secret
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new business
- `POST /api/auth/login` - Login with phone + PIN
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/change-pin` - Change PIN

### Admin Setup (One-time)
- `POST /api/setup/init-admin` - Initialize admin account

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC
