<div align="center">

# 🏋️ FitnessFreak AI

### AI-Powered Posture Correction & Personalised Diet Planning

[![Live Demo](https://img.shields.io/badge/Live%20Demo-fitness--freaks--ai.onrender.com-22c573?style=for-the-badge&logo=render&logoColor=white)](https://fitness-freaks-ai-upgraded.onrender.com)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-MoveNet-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/js)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<br/>

![FitnessFreak AI Banner](https://images.pexels.com/photos/5384613/pexels-photo-5384613.jpeg?auto=compress&cs=tinysrgb&w=900)

<br/>

> **FitnessFreak AI** is a full-stack web application that uses **computer vision** and **nutritional science algorithms** to help users correct their posture in real time and generate personalised daily meal plans — completely free, no account required.

</div>

---

## 📌 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Deployment](#-deployment)
- [Screenshots](#-screenshots)
- [Author](#-author)

---

## ✨ Features

### 🎯 AI Posture Checker
- **In-browser pose detection** using TensorFlow.js MoveNet Lightning — no server upload, 100% private
- Detects **17 body keypoints** in real time via webcam
- Calculates a **live posture score (0–100)** using joint angle analysis
- Visual **skeleton overlay** drawn on canvas
- Instant **Good Posture / Fix Your Posture** feedback badge
- Works on **desktop and mobile** (front + back camera flip)
- Full **permission error handling** with user-friendly messages
- HTTPS guard with clear error if camera is accessed over HTTP

### 🥗 AI Diet Generator
- Calculates **BMI**, **BMR** (Harris-Benedict), and **TDEE** from user inputs
- Gender-aware calorie targets
- Generates a full **Breakfast → Lunch → Dinner → Snacks** meal plan
- Colour-coded **BMI category** (Normal / Overweight / Obese / Underweight)
- **Export meal plan** as a downloadable `.txt` file
- Clean JSON REST API (`POST /api/bmi`)

### 🎨 UI/UX
- Dark athletic design system with `#22c573` green accent
- **Syne** (display) + **Inter** (body) typography
- Scroll-triggered **AOS animations**
- Animated **preloader**
- **Mobile-first** responsive layout
- Slide-in **mobile navigation drawer**
- **Toast notification** system
- Frosted-glass sticky header
- Gallery with **GLightbox** lightbox

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.10, Flask 3.0 |
| **Pose Detection (Browser)** | TensorFlow.js, MoveNet Lightning |
| **Pose Detection (Server)** | MediaPipe, OpenCV, CVZone |
| **Frontend** | HTML5, CSS3, Bootstrap 5, Vanilla JS |
| **Animations** | AOS (Animate On Scroll) |
| **Lightbox** | GLightbox |
| **Icons** | Bootstrap Icons |
| **Fonts** | Google Fonts (Syne, Inter) |
| **Server** | Gunicorn (production), Flask dev server (local) |
| **Deployment** | Render.com |

---

## 📁 Project Structure

```
fitness-freaks-upgraded/
│
├── app/
│   ├── __main__.py              # Flask app — routes + BMI API + MJPEG stream
│   ├── poseEstimation.py        # Server-side MediaPipe pose detection
│   │
│   ├── static/
│   │   ├── css/
│   │   │   └── main.css         # Complete design system (700+ lines)
│   │   ├── js/
│   │   │   ├── main.js          # Global: preloader, header, mobile nav, toast
│   │   │   ├── posture.js       # TensorFlow.js MoveNet webcam engine
│   │   │   └── diet.js          # BMI API call, render, export, validation
│   │   ├── img/                 # Favicons and static images
│   │   └── vendor/              # Bootstrap, AOS, GLightbox, Bootstrap Icons
│   │
│   └── templates/
│       ├── base.html            # Base layout — header, footer, scripts
│       ├── index.html           # Homepage — hero, features, gallery, CTA
│       ├── posture-checker.html # Webcam UI — mode toggle, score ring, tips
│       ├── dietgenerator.html   # Diet form — metric cards, accordion, export
│       ├── services.html        # Services overview
│       ├── about.html           # About + contact info
│       └── contact.html         # Contact form with JSON validation
│
├── Procfile                     # gunicorn start command for Render/Heroku
├── render.yaml                  # Render.com deployment config
├── requirements.txt             # Python dependencies
├── runtime.txt                  # Python version pin
├── .env.example                 # Environment variable template
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- pip
- Git

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/fitness-freaks-ai.git
cd fitness-freaks-ai
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Set up environment variables
```bash
cp .env.example .env
# Edit .env and set your SECRET_KEY
```

### 4. Run the app
```bash
python -m app
```

### 5. Open in browser
```
http://localhost:5000
```

> **Note:** Webcam works on `localhost` without HTTPS. For any other domain, HTTPS is required (all cloud deployments provide this automatically).

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | ✅ Yes | Flask session secret — any random string |
| `FLASK_ENV` | Optional | Set to `production` on deployment |
| `PORT` | Auto | Set automatically by Render/Railway |

Generate a secure key:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 📡 API Reference

### `POST /api/bmi`

Calculates BMI, BMR, TDEE and returns a structured meal plan.

**Request Body (JSON):**
```json
{
  "height": 170,
  "weight": 65,
  "age": 22,
  "gender": "female"
}
```

**Response (200 OK):**
```json
{
  "bmi": 22.5,
  "category": "Normal weight",
  "bmr": 1467,
  "tdee": 2274,
  "plan": {
    "goal": "Maintain weight",
    "target_calories": 2274,
    "breakfast": [{ "name": "Oatmeal with berries", "cal": 320 }],
    "lunch": [...],
    "dinner": [...],
    "snacks": [...],
    "hydration": "Drink at least 8–10 glasses of water daily.",
    "tip": "Eat balanced macros: ~50% carbs, 25% protein, 25% healthy fats."
  }
}
```

**Error Response (400):**
```json
{ "error": "Height and weight must be positive numbers." }
```

---

## ☁️ Deployment

### Deploy on Render (Recommended)

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Render auto-detects `render.yaml`
5. Add environment variable: `SECRET_KEY` → your random string
6. Click **Deploy**

Your app will be live at:
```
https://your-app-name.onrender.com
```

### Deploy on Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Deploy on PythonAnywhere

1. Upload ZIP → Extract
2. Install requirements in Bash console
3. Configure WSGI file pointing to `app.__main__:app`
4. Reload web app

---

## 📸 Screenshots

| Page | Description |
|------|-------------|
| **Homepage** | Dark hero with floating AI stat cards, features strip, gallery |
| **Posture Checker** | Live webcam with skeleton overlay, posture score ring |
| **Diet Generator** | Split-panel form + BMI cards + meal accordion |
| **Contact** | Clean form with inline validation |

---

## 🧪 Running Tests

```bash
python -c "
from app.__main__ import app
with app.test_client() as c:
    for route in ['/', '/services', '/about-us', '/contact-us', '/diet-generator', '/posture-checker']:
        r = c.get(route)
        print(f'{\"✅\" if r.status_code==200 else \"❌\"} {route} → {r.status_code}')
"
```

---

## 👩‍💻 Author

<div align="center">

**Karishma Sain**
B.Tech Computer Science | Graduating 2026

[![GitHub](https://img.shields.io/badge/GitHub-karishmasain-181717?style=flat-square&logo=github)](https://github.com/karishmasain)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-karishmasain-0A66C2?style=flat-square&logo=linkedin)](https://linkedin.com/in/karishmasain)
[![Email](https://img.shields.io/badge/Email-karishmasain2004@gmail.com-EA4335?style=flat-square&logo=gmail)](mailto:karishmasain2004@gmail.com)

</div>

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with ❤️ by Karishma ✨ &nbsp;|&nbsp; © 2025 FitnessFreak AI

⭐ **Star this repo if you found it useful!**

</div>
