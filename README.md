# Smart Parking Finder System (Sprint 2)

A responsive, mobile-first web application designed to help drivers locate nearby parking spaces in real time based on their location.

## Key Features (Sprint 2)
Dynamic Dashboard: Renders parking availability dynamically with color-coded indicators (Green: Available, Amber: Almost Full ≤ 20%, Red: Full).
Live Distance Calculation: Uses the browser Geolocation API and Haversine formula to compute live distances. Falls back to Dublin city center if location access is denied.
Smart Recommendation: Instantly highlights the closest optimal parking lot. 
Strict Exclusion Rule: Parking areas with zero (0) available spaces are completely excluded from recommendations.
Admin Simulation Panel: Allows updates to parking space counts with an immediate live UI re-render on the dashboard.

## Tech Stack & Constraints
Frontend: HTML5, CSS3, Vanilla JavaScript (ES6+).
Architecture: Strictly client-side only. There is no backend server or database integration. All data updates are simulated locally and reset upon page refresh.

## How to Run
1. Clone or download this repository.
2. Open `index.html` directly in any modern web browser.