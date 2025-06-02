# 🎨 Tessellation App

An interactive tessellation creator built with Next.js, TypeScript, and Tailwind CSS. Create beautiful geometric patterns with smart snapping, symmetry modes, and accessibility features.

![Tessellation App Preview](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## ✨ Features

### 🔧 Core Functionality
- **Interactive Shapes**: Triangle, Square, Hexagon, Diamond
- **Smart Snapping**: Automatic edge-to-edge alignment
- **Drag & Drop**: Mouse and touch support
- **Rotation**: 45-degree increments
- **Color Palette**: 10 beautiful colors to choose from

### 🎯 Advanced Features
- **Symmetry Modes**: None, Horizontal, Vertical, Radial
- **Smart Fill**: AI-powered pattern suggestions
- **Multi-touch**: Simultaneous tile manipulation
- **Grid Overlay**: Optional alignment guide
- **SVG Export**: Download your creations

### ♿ Accessibility (WCAG AA Compliant)
- **Full Keyboard Navigation**: Arrow keys, shortcuts
- **Screen Reader Support**: Comprehensive ARIA labels
- **Focus Management**: Clear visual indicators
- **Live Announcements**: Real-time feedback
- **Semantic HTML**: Proper landmarks and structure

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/tessellation-app.git
cd tessellation-app

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🎮 How to Use

### Mouse/Touch Controls
- **Click/Tap**: Select a tile
- **Drag**: Move tiles around the canvas
- **Release**: Auto-snap to compatible edges

### Keyboard Controls
- **Arrow Keys**: Move selected tile (hold Shift for faster movement)
- **R**: Rotate selected tile
- **D**: Duplicate selected tile
- **Delete/Backspace**: Remove selected tile
- **Tab**: Navigate through interface elements

### Creating Patterns
1. **Add Shapes**: Click shape buttons in the sidebar
2. **Choose Colors**: Select from the color palette
3. **Set Symmetry**: Enable mirror modes for complex patterns
4. **Smart Fill**: Use AI suggestions to complete patterns
5. **Export**: Download as SVG when finished

## 🛠️ Technical Details

### Architecture
- **Framework**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: GitHub Pages (static export)

### Performance Optimizations
- RequestAnimationFrame for smooth 60fps movement
- Efficient edge calculation algorithms
- Optimized React renders with useCallback/useMemo

### Accessibility Features
- Semantic HTML5 landmarks
- ARIA attributes for complex interactions
- Live regions for screen reader announcements
- Keyboard-only operation support
- High contrast focus indicators

## 📦 Deployment

### GitHub Pages
```bash
# Build and deploy to GitHub Pages
npm run deploy
```

### Manual Deployment
```bash
# Build static files
npm run build

# Files will be in the 'out' directory
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Geometric algorithms inspired by computational geometry principles
- Accessibility guidelines based on WCAG 2.1 AA standards
- UI/UX patterns from modern design systems

---

**Made with ❤️ and TypeScript**

[Live Demo](https://YOUR_USERNAME.github.io/tessellation-app/) | [Report Bug](https://github.com/YOUR_USERNAME/tessellation-app/issues) | [Request Feature](https://github.com/YOUR_USERNAME/tessellation-app/issues)
