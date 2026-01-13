# BC Emissions Interactive Map

An interactive visualization of British Columbia's community-level greenhouse gas emissions data for 2022.

![Swiss Design System](https://img.shields.io/badge/Design-Swiss%20Style-black)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Features

### 🗺️ Interactive Map
- Google Maps integration with BC boundaries
- Color-coded markers (green/yellow/red) based on emission thresholds
- Dynamic marker sizing based on emission values
- Click markers to view community details

### 📊 Dashboard
- Summary statistics (total communities, emissions, averages)
- Segment distribution visualization
- Top 10 communities by emissions
- Real-time filter updates

### 🎛️ Filtering Controls
- **Segment Filter**: Residential, Commercial/Industrial, Mixed
- **Threshold Slider**: 0 - 1,000,000 TCO₂e
- Quick threshold presets
- One-click filter reset

### 📋 Community Details
- Total emissions with threshold comparison
- Segment breakdown with visual bars
- Top emission sources by type
- Geographic coordinates

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Backend**: tRPC, Prisma (SQLite)
- **Maps**: @vis.gl/react-google-maps
- **Design**: International Typographic Style (Swiss Design)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Maps API key (optional, for map display)

### Installation

```bash
# Install dependencies
npm install

# Set up the database
npm run db:push

# Seed the database with BC emissions data
npm run db:seed

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file:

```env
DATABASE_URL="file:./prisma/dev.db"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
```

To get a Google Maps API key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
2. Enable "Maps JavaScript API"
3. Create credentials and copy the API key

**Note**: The app works without a Google Maps API key - it will display a placeholder with the data loaded.

## Data Source

Data is sourced from BC's Community Energy & Emissions Inventory (CEEI) 2022:
- [BC CEEI Data](https://www2.gov.bc.ca/gov/content/environment/climate-change/data/ceei)

### Emissions Segments

- **Res (Residential)**: Homes, apartments, housing
- **CSMI (Commercial/Industrial)**: Businesses, manufacturing, industrial
- **MIXED**: Combined residential/commercial use

## Project Structure

```
bc-emissions-map/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Data seeding script
│   └── dev.db             # SQLite database
├── src/
│   ├── app/
│   │   ├── page.tsx       # Main application
│   │   ├── layout.tsx     # Root layout
│   │   ├── globals.css    # Swiss design system
│   │   └── api/trpc/      # tRPC API routes
│   ├── components/
│   │   ├── EmissionsMap.tsx    # Google Maps component
│   │   ├── FilterControls.tsx  # Segment & threshold filters
│   │   ├── CommunityDetail.tsx # Community info panel
│   │   └── Dashboard.tsx       # Statistics dashboard
│   ├── lib/
│   │   ├── prisma.ts      # Prisma client singleton
│   │   ├── trpc.ts        # tRPC React client
│   │   └── providers.tsx  # React Query + tRPC provider
│   └── server/trpc/
│       ├── trpc.ts        # tRPC initialization
│       └── router.ts      # API procedures
└── package.json
```

## API Endpoints

### tRPC Procedures

| Procedure | Description |
|-----------|-------------|
| `getAllCommunities` | Get all communities with location data |
| `getFilteredCommunities` | Filter by segments and threshold |
| `getCommunityDetails` | Get detailed breakdown for a community |
| `getSummaryStats` | Get aggregate statistics |

## Design System

This project implements the **International Typographic Style** (Swiss Design):

- **Typography**: Archivo (Helvetica-inspired), JetBrains Mono for data
- **Colors**: Black, white, Swiss red accents
- **Layout**: Asymmetric grid, fine divider lines
- **Animation**: Subtle, purposeful motion

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run db:push      # Push schema to database
npm run db:seed      # Seed database with emissions data
npm run db:studio    # Open Prisma Studio
npm run lint         # Run ESLint
```

## Calculations & Methodology

See **[CALCULATIONS.md](./CALCULATIONS.md)** for detailed documentation on:
- How emissions savings are calculated
- Rebate calculation formulas
- Data sources and assumptions
- BC regulatory benchmarks used
- Emission factors and conversions
- Limitations and uncertainties

## License

MIT

## Acknowledgments

- BC Climate Action Secretariat for the emissions data
- Google Maps Platform for mapping services
