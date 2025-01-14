# Heuristic Checker - Figma Plugin

A Figma plugin that helps designers identify potential usability issues through automated heuristic evaluation and AI-powered insights.

## Features

- Automated usability heuristic checks
- Real-time design analysis
- AI-powered suggestions
- Comprehensive reporting
- WCAG compliance checking

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. Import the plugin into Figma

## Development

### Prerequisites
- Node.js (v16 or higher)
- npm (v7 or higher)
- Figma desktop app

### Setup
1. Run `npm install` to install dependencies
2. Run `npm run dev` for development mode with hot reload
3. Open Figma desktop app
4. Import the plugin from the `manifest.json` file

### Scripts
- `npm run dev`: Start development mode with hot reload
- `npm run build`: Build for production
- `npm run test`: Run tests
- `npm run lint`: Run linter

## Project Structure
```
/
├── src/
│   ├── plugin/         # Plugin logic
│   │   └── code.ts
│   └── ui/            # UI components
│       ├── components/
│       └── index.tsx
├── dist/              # Build output
└── manifest.json      # Figma plugin manifest
```

## License
MIT License - see LICENSE file for details

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
