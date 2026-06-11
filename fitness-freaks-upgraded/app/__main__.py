import os
import json
import time
from flask import Flask, render_template, Response, jsonify, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "fitness-freaks-dev-key-change-in-prod")

# --- Webcam / Pose detection (server-side MJPEG) ---
_cam = None
_detector = None

def get_camera():
    global _cam, _detector
    try:
        import cv2
        from poseEstimation import PoseDetector
        if _cam is None:
            _cam = cv2.VideoCapture(0)
        if _detector is None:
            _detector = PoseDetector(
                staticMode=False, modelComplexity=1,
                smoothLandmarks=True, enableSegmentation=False,
                smoothSegmentation=True, detectionCon=0.5, trackCon=0.5
            )
        return _cam, _detector
    except Exception:
        return None, None


def generate_frames():
    """MJPEG stream with posture analysis overlay."""
    import cv2
    import numpy as np

    cam, detector = get_camera()

    # No camera on server — emit a single info frame then stop
    if cam is None or not cam.isOpened():
        placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(placeholder, "Webcam unavailable on server.", (60, 220),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (100, 200, 130), 2)
        cv2.putText(placeholder, "Use the in-browser mode instead.", (55, 265),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (180, 180, 180), 1)
        ret, buf = cv2.imencode(".jpg", placeholder)
        if ret:
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buf.tobytes() + b'\r\n')
        return

    while True:
        success, img = cam.read()
        if not success:
            break

        img = detector.findPose(img, draw=False)
        lmList, bboxInfo = detector.findPosition(img, draw=False, bboxWithHands=False)

        if lmList:
            center = bboxInfo["center"]
            cv2.circle(img, center, 5, (255, 0, 255), cv2.FILLED)

            length, img, _ = detector.findDistance(
                lmList[11][0:2], lmList[25][0:2],
                img=img, color=(255, 0, 0), scale=10, draw=False
            )
            angle, img = detector.findAngle(
                lmList[11][0:2], lmList[23][0:2], lmList[25][0:2],
                img=img, color=(0, 0, 255), scale=5, draw=False
            )

            good = detector.angleCheck(angle, 90, 10) or detector.angleCheck(angle, 180, 10)
            label = "Good Posture" if good else "Fix Your Posture"
            color = (0, 220, 100) if good else (0, 60, 255)

            # Semi-transparent banner
            overlay = img.copy()
            cv2.rectangle(overlay, (0, 0), (img.shape[1], 70), (0, 0, 0), -1)
            cv2.addWeighted(overlay, 0.5, img, 0.5, 0, img)
            cv2.putText(img, label, (20, 50),
                        cv2.FONT_HERSHEY_DUPLEX, 1.4, color, 2)

        ret, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if ret:
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buf.tobytes() + b'\r\n')


# ---- Routes ---------------------------------------------------------------

@app.route('/')
def home():
    return render_template("index.html", home="active")

@app.route("/services")
def service():
    return render_template("services.html", services="active")

@app.route("/contact-us", methods=["GET", "POST"])
def contact():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip()
        subject = request.form.get("subject", "").strip()
        message = request.form.get("message", "").strip()
        if not all([name, email, subject, message]):
            return jsonify({"status": "error", "message": "All fields are required."}), 400
        # In production wire up SMTP / SendGrid here
        return jsonify({"status": "success", "message": "Message received! We'll get back to you."})
    return render_template("contact.html", contact="active")

@app.route("/about-us")
def about():
    return render_template("about.html", about="active")

@app.route("/diet-generator")
def diet():
    return render_template("dietgenerator.html", services="active")

@app.route("/posture-checker")
def checker():
    return render_template("posture-checker.html", services="active")

@app.route("/video")
def video():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route("/api/bmi", methods=["POST"])
def bmi_api():
    """JSON API for BMI calculation used by the diet generator."""
    data = request.get_json(silent=True) or {}
    try:
        height = float(data.get("height", 0))
        weight = float(data.get("weight", 0))
        gender = str(data.get("gender", "")).strip().lower()
        age    = int(data.get("age", 25))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid input"}), 400

    if height <= 0 or weight <= 0:
        return jsonify({"error": "Height and weight must be positive numbers."}), 400
    if gender not in ("male", "female"):
        return jsonify({"error": "Gender must be 'male' or 'female'."}), 400

    bmi = weight / ((height / 100) ** 2)
    bmi = round(bmi, 1)

    if bmi < 18.5:
        category = "Underweight"
    elif bmi < 25:
        category = "Normal weight"
    elif bmi < 30:
        category = "Overweight"
    else:
        category = "Obese"

    # Harris-Benedict BMR
    if gender == "male":
        bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
    else:
        bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)

    tdee = round(bmr * 1.55)   # moderate activity

    plans = _build_meal_plan(gender, category, tdee)

    return jsonify({
        "bmi": bmi,
        "category": category,
        "bmr": round(bmr),
        "tdee": tdee,
        "plan": plans
    })


def _build_meal_plan(gender, category, tdee):
    """Return a structured meal plan dict."""
    # Target calories by goal
    goal_map = {
        "Underweight": tdee + 400,
        "Normal weight": tdee,
        "Overweight": tdee - 350,
        "Obese": tdee - 600,
    }
    target = goal_map.get(category, tdee)

    breakfast_pool = [
        {"name": "Oatmeal with berries & almonds", "cal": 320},
        {"name": "Whole grain toast with avocado & egg", "cal": 340},
        {"name": "Greek yogurt parfait with granola", "cal": 280},
        {"name": "Veggie omelette (3 eggs, spinach, peppers)", "cal": 310},
        {"name": "Banana-peanut butter protein smoothie", "cal": 380},
    ]
    lunch_pool = [
        {"name": "Grilled chicken quinoa bowl", "cal": 450},
        {"name": "Lentil soup + whole grain bread", "cal": 380},
        {"name": "Tuna-stuffed whole wheat wrap", "cal": 400},
        {"name": "Mixed greens salad with grilled salmon", "cal": 360},
        {"name": "Brown rice stir-fry with tofu & veg", "cal": 420},
    ]
    dinner_pool = [
        {"name": "Baked salmon, sweet potato & broccoli", "cal": 480},
        {"name": "Chicken tikka with cucumber raita & roti", "cal": 500},
        {"name": "Lentil dal with steamed basmati", "cal": 420},
        {"name": "Grilled paneer with sautéed vegetables", "cal": 410},
        {"name": "Turkey meatballs with zucchini noodles", "cal": 390},
    ]
    snack_pool = [
        {"name": "Handful of mixed nuts", "cal": 160},
        {"name": "Apple with almond butter", "cal": 180},
        {"name": "Cottage cheese + cucumber slices", "cal": 120},
        {"name": "Protein bar", "cal": 200},
    ]

    return {
        "target_calories": target,
        "goal": "Gain weight" if category == "Underweight" else
                "Maintain weight" if category == "Normal weight" else "Lose weight",
        "breakfast": breakfast_pool[:3],
        "lunch":     lunch_pool[:3],
        "dinner":    dinner_pool[:3],
        "snacks":    snack_pool[:2],
        "hydration": "Drink at least 8–10 glasses (2–2.5 L) of water daily.",
        "tip": ("Focus on calorie-dense whole foods." if category == "Underweight"
                else "Prioritise lean protein, fibre, and whole grains."
                if category in ("Overweight", "Obese")
                else "Eat balanced macros: ~50% carbs, 25% protein, 25% healthy fats."),
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
