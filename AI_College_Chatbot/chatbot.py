import os
import json
import re
from typing import Generator, List, Dict, Any, Optional
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# Load college knowledge base
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "college_info.json")
COLLEGE_DATA: Dict[str, Any] = {}

if os.path.exists(DATA_PATH):
    try:
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            COLLEGE_DATA = json.load(f)
    except Exception as e:
        print(f"Error loading college_info.json: {e}")

# Preferred models in order of speed and availability on NVIDIA NIM
PREFERRED_MODELS = [
    "openai/gpt-oss-20b",
    "google/gemma-3-12b-it",
    "mistralai/mistral-7b-instruct-v0.3",
    "meta/llama-3.2-11b-vision-instruct"
]

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
ACTIVE_MODEL = os.getenv("AI_MODEL", PREFERRED_MODELS[0])

client: Optional[OpenAI] = None
if NVIDIA_API_KEY:
    try:
        client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=NVIDIA_API_KEY,
            timeout=25.0
        )
    except Exception as err:
        print(f"Failed to initialize OpenAI client: {err}")


def build_system_prompt() -> str:
    """Creates a comprehensive system prompt tailored for freshers and newly joining students."""
    college = COLLEGE_DATA.get("college", {})
    college_name = college.get("name", "our College & University Campus")
    
    prompt = f"""You are 'CampusPulse' — an intelligent, friendly, and deeply encouraging AI College Senior & Campus Navigator for {college_name}.

YOUR CORE MISSION:
Your primary purpose is to help newly joined students (freshers) understand their college background, adapt quickly, navigate campus life smoothly, overcome anxieties, and succeed academically and socially.

KEY DOMAINS OF ASSISTANCE:
1. COLLEGE BACKGROUND & CULTURE: History, accreditation ({college.get('accreditation', 'NAAC / NBA')}), legacy, traditions, campus values, and pride.
2. FIRST-YEAR ONBOARDING & REGISTRATION: Orientation week roadmap, required documents, student ID cards, biometric registration, campus Wi-Fi & LMS credentials.
3. ACADEMICS & GRADING: Demystify the 10-point CGPA vs SGPA system, credit structures, continuous internal assessments, mandatory 75% attendance rule, passing thresholds, and study tips from seniors.
4. CAMPUS FACILITIES & NAVIGATION: Central library timings, digital journals, computer centers, labs, medical/health center, canteen & mess, sports complexes, ATMs, and shuttle buses.
5. HOSTEL & RESIDENTIAL LIFE: Room allotment, curfew timings (e.g. 9:00 PM), packing checklists (bedding, extension cords, toiletries, locks), laundry, mess food system, and roommate etiquette.
6. CLUBS, SOCIETIES & FESTS: Technical clubs (coding, AI, robotics), cultural societies (music, dance, drama), sports teams, annual college fests, hackathons, and auditions.
7. SAFETY, WELLBEING & ANTI-RAGGING: Zero-tolerance anti-ragging policy, campus flying squad, national 24x7 toll-free anti-ragging helpline (1800-180-5522), student counseling center, and faculty mentors.
8. CAREER & FUTURE ROADMAP: How to start preparing from 1st year (building projects, internships, GitHub, networking, balancing academics and fun).

COMMUNICATION STYLE GUIDELINES:
- Warm, welcoming, respectful, and senior-mentor friendly (use cheerful emojis like 🎓, 📚, 🏢, ✨, 💡 appropriately).
- Structure responses clearly with bold section titles, bullet points, and numbered action steps.
- Avoid overwhelming walls of text. Be concise, actionable, and practical.
- If asked about ragging, immediately state the zero-tolerance stance and provide the 24x7 toll-free helpline: 1800-180-5522.
- If a student feels homesick, overwhelmed, or anxious, provide empathetic reassurance, practical steps to make friends, and encourage visiting the campus counseling center.
"""
    return prompt


def generate_fallback_response(query: str) -> str:
    """Smart local knowledge responder if AI API is temporarily unavailable."""
    q = query.lower()
    
    # Anti-ragging inquiry
    if any(k in q for k in ["ragging", "bullied", "bully", "abuse", "harass", "complaint", "safety"]):
        return (
            "### 🛡️ Campus Anti-Ragging & Student Safety\n\n"
            "Our campus maintains an absolute **Zero-Tolerance Policy** towards any form of ragging or harassment. "
            "Every student has the right to study in a safe, dignified environment.\n\n"
            "**Emergency & Reporting Contacts (24x7):**\n"
            "- 📞 **National Anti-Ragging Toll-Free Helpline:** `1800-180-5522`\n"
            "- 🏫 **Campus Anti-Ragging Flying Squad:** `+91 80-2345-6799`\n"
            "- 📧 **Email:** `helpline@antiragging.in`\n"
            "- 🌐 **Online Portal:** [antiragging.in](https://antiragging.in)\n\n"
            "*Your identity will remain completely confidential. Do not hesitate to reach out!*"
        )
        
    # Attendance rule
    if any(k in q for k in ["attendance", "75%", "attendence", "detain", "leave"]):
        return (
            "### 📚 The Mandatory 75% Attendance Rule\n\n"
            "As a fresher, one of the most critical academic rules is maintaining regular attendance:\n\n"
            "- **Minimum Requirement:** You must maintain at least **75% attendance** in both lectures and practical labs for every subject.\n"
            "- **Medical Condonation:** If attendance falls between 65% and 74% due to medical reasons, a valid medical certificate verified by the University Medical Officer is required.\n"
            "- **Detention Warning:** Falling below 65% results in being detained from appearing in end-semester examinations.\n\n"
            "💡 *Pro-Tip from Seniors:* Track your attendance weekly on the student portal so you never face a crunch before semester exams!"
        )
        
    # CGPA & Grading
    if any(k in q for k in ["cgpa", "sgpa", "grade", "grading", "marks", "credits", "gpa"]):
        return (
            "### 🎓 Demystifying the CGPA & Grading System\n\n"
            "Colleges follow a **10-Point Grading Scale**:\n\n"
            "- **O (Outstanding):** 10 grade points (90%+)\n"
            "- **A+ (Excellent):** 9 grade points (80-89%)\n"
            "- **A (Very Good):** 8 grade points (70-79%)\n"
            "- **B+ (Good):** 7 grade points (60-69%)\n"
            "- **F (Fail):** 0 grade points (<40%)\n\n"
            "**Formula:**\n"
            "- **SGPA (Semester GPA):** `Sum(Credits × Grade Points) ÷ Total Semester Credits`\n"
            "- **CGPA:** Cumulative average of all semesters completed so far.\n\n"
            "🌟 *Senior Tip:* 1st-year subjects are relatively straightforward compared to advanced core years. Aim for an **8.5+ CGPA** in your first year to build a high cushion!"
        )
        
    # Orientation & Documents
    if any(k in q for k in ["orientation", "induction", "first day", "document", "id card", "registration"]):
        return (
            "### 📋 Freshers Orientation & Induction Roadmap\n\n"
            "Welcome to college! Here is what you need for a seamless start:\n\n"
            "**Essential Documents Checklist:**\n"
            "1. Seat allotment letter & fee payment receipts\n"
            "2. 10th & 12th original marksheets + 3 self-attested photocopies\n"
            "3. Transfer Certificate (TC) & Migration Certificate\n"
            "4. 6 recent passport-size photographs\n"
            "5. Govt Photo ID (Aadhaar / Passport)\n"
            "6. Anti-ragging affidavit signed online via [antiragging.in](https://antiragging.in)\n\n"
            "**Orientation Week Schedule:**\n"
            "- **Day 1:** Welcome address by Dean & campus tour\n"
            "- **Day 2:** Department faculty introduction & mentor assignment\n"
            "- **Day 3:** Student ID card issuance & biometric enrollment\n"
            "- **Day 4:** Campus Wi-Fi & LMS (Canvas/Moodle) credentials\n"
            "- **Day 5:** Club Fair & Freshers talent show"
        )
        
    # Hostel & Mess
    if any(k in q for k in ["hostel", "mess", "room", "curfew", "packing", "laundry"]):
        return (
            "### 🏢 Hostel Life & Freshers Packing Checklist\n\n"
            "Living in the hostel is an incredible experience for making lifelong friends! Here are the core details:\n\n"
            "**Hostel Guidelines:**\n"
            "- **Curfew Timings:** 9:00 PM on weekdays, 9:30 PM on weekends. Night-outs require an approved digital pass.\n"
            "- **Facilities:** 24/7 high-speed Wi-Fi, RO water, geysers, laundromat, recreation room (Table Tennis, TV).\n\n"
            "**Must-Pack Essentials for Freshers:**\n"
            "- 🛏️ Mattress cover, 2 bedsheets, pillow, light blanket\n"
            "- 🔌 Power surge extension board (at least 3-4 sockets)\n"
            "- 🧼 Bucket, mug, toiletry pouch, hangers, laundry bag\n"
            "- 💊 Personal first-aid kit (paracetamol, band-aids, antacids)\n"
            "- 🔒 Two sturdy brass padlocks with duplicate keys"
        )

    # Clubs & Extracurriculars
    if any(k in q for k in ["club", "societies", "fest", "cultural", "robotics", "coding", "sports"]):
        return (
            "### 🎭 Campus Clubs, Societies & Student Life\n\n"
            "College is about exploring your passions beyond textbooks! We have over 20+ active student clubs:\n\n"
            "- **💻 Technical Clubs:** *CodeCrafters* (competitive programming, web/AI hackathons), *RoboGenesis* (drones, IoT & bots)\n"
            "- **🎨 Cultural Societies:** *Rhythm & Raag* (college band & dance troupe), Dramatics Society, Fine Arts\n"
            "- **🎤 Literary & Debating:** MUN (Model United Nations), Quiz Club, Toastmasters\n"
            "- **⚽ Sports & Fitness:** Cricket, Football, Badminton, Basketball, Volleyball, and indoor gym\n"
            "- **🤝 Social Impact:** NSS & Rotaract Club (social outreach, blood drives)\n\n"
            "🎉 **How to Join:** Attend the annual **Club Fair** during orientation week. Freshers do NOT need prior experience to join beginner auditions!"
        )

    # Default friendly greeting & overview
    return (
        "### 🎓 Welcome to College! I'm CampusPulse, your AI Senior & Navigator\n\n"
        "Starting college is an exciting new chapter! I am here to guide you through everything you need to know about our campus background and fresher journey.\n\n"
        "**Popular Topics You Can Ask Me:**\n"
        "- 📑 **Orientation & Checklist:** What documents to bring and what happens in week 1.\n"
        "- 📚 **CGPA & Academics:** How the 10-point grading system, credits, and the 75% attendance rule work.\n"
        "- 🏢 **Hostel & Mess Life:** Curfew timings, food menu, and essential things to pack.\n"
        "- 🎭 **Clubs & Fests:** How to join coding, robotics, cultural, or sports societies.\n"
        "- 🛡️ **Student Safety & Anti-Ragging:** Helplines, policies, and mental health support.\n"
        "- 🗺️ **Campus Facilities:** Library access, labs, gym, and medical center.\n\n"
        "Feel free to ask any specific question, or click one of the suggestion chips above to get started!"
    )


def format_messages_with_history(message: str, history: Optional[List[Dict[str, str]]] = None) -> List[Dict[str, str]]:
    """Builds a formatted list of messages including system instructions and recent conversation turns."""
    messages = [
        {"role": "system", "content": build_system_prompt()}
    ]
    
    # Append recent conversation history (capped at last 8 messages to prevent token bloat)
    if history and isinstance(history, list):
        for turn in history[-8:]:
            role = turn.get("role", "")
            content = turn.get("content", "").strip()
            if role in ["user", "assistant"] and content:
                messages.append({"role": role, "content": content})
                
    # Append current user message
    messages.append({"role": "user", "content": message})
    return messages


def stream_chat_response(message: str, history: Optional[List[Dict[str, str]]] = None) -> Generator[str, None, None]:
    """
    Streams the AI response chunk by chunk for ultra-fast, zero-lag perceived performance.
    Falls back gracefully if the external API is unavailable.
    """
    if not client or not NVIDIA_API_KEY:
        # Fallback generator
        fallback = generate_fallback_response(message)
        words = re.split(r"(\s+)", fallback)
        for w in words:
            yield w
        return

    messages = format_messages_with_history(message, history)
    
    models_to_try = [ACTIVE_MODEL] + [m for m in PREFERRED_MODELS if m != ACTIVE_MODEL]
    
    for model_name in models_to_try:
        try:
            stream = client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.7,
                top_p=0.95,
                max_tokens=1024,
                stream=True
            )
            
            has_yielded = False
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    has_yielded = True
                    yield chunk.choices[0].delta.content
                    
            if has_yielded:
                return
        except Exception as e:
            print(f"Streaming error with model {model_name}: {e}")
            continue

    # If all models failed or network issue, yield from fallback knowledge base
    fallback = generate_fallback_response(message)
    words = re.split(r"(\s+)", fallback)
    for w in words:
        yield w


def get_chat_response(message: str, history: Optional[List[Dict[str, str]]] = None) -> str:
    """Non-streaming response method for standard API calls."""
    if not client or not NVIDIA_API_KEY:
        return generate_fallback_response(message)
        
    messages = format_messages_with_history(message, history)
    models_to_try = [ACTIVE_MODEL] + [m for m in PREFERRED_MODELS if m != ACTIVE_MODEL]
    
    for model_name in models_to_try:
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.7,
                top_p=0.95,
                max_tokens=1024,
                stream=False
            )
            content = response.choices[0].message.content
            if content:
                return content
        except Exception as e:
            print(f"Completion error with model {model_name}: {e}")
            continue
            
    return generate_fallback_response(message)


def get_college_handbook_data() -> Dict[str, Any]:
    """Returns the college handbook summary for the UI guide modal."""
    return COLLEGE_DATA
