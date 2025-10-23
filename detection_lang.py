import speech_recognition as sr
from googletrans import Translator
from textblob import TextBlob

# Initialize recognizer and translator
r = sr.Recognizer()
translator = Translator()
r.energy_threshold = 300  # Adjust if speech is faint

def generate_vet_reply(text_en):
    """
    Generate a veterinary-specific reply based on sentiment.
    You can expand responses based on sentiment or keywords.
    """
    blob = TextBlob(text_en)
    polarity = blob.sentiment.polarity
    
    # Positive sentiment
    if polarity > 0.1:
        return "I'm glad to hear that! Your pet seems to be doing well."
    # Negative sentiment
    elif polarity < -0.1:
        return "I'm sorry to hear that. Can you describe the symptoms in more detail?"
    # Neutral sentiment
    else:
        return "Thank you for sharing. Could you tell me more about your pet's condition?"

with sr.Microphone() as source:
    print("🎤 Adjusting for ambient noise, please wait...")
    r.adjust_for_ambient_noise(source, duration=1)
    print("🎤 Welcome to VetBot! You can start speaking. Say 'stop' to end.")

    while True:
        print("\nListening...")
        audio = r.listen(source)

        try:
            # Recognize user speech
            text = r.recognize_google(audio)
            print("🗣️ You said (original):", text)

            # Stop condition
            if text.lower() in ["stop", "exit", "quit"]:
                print("🛑 Ending VetBot conversation.")
                break

            # Detect language
            detected = translator.detect(text)
            language = detected.lang
            print(f"🌐 Detected language: {language}")

            # Translate to English for analysis
            text_en = translator.translate(text, src=language, dest='en').text

            # Generate reply based on sentiment
            reply_en = generate_vet_reply(text_en)
            print("🤖 VetBot (English):", reply_en)

            # Translate reply back to user's language
            reply_src = translator.translate(reply_en, src='en', dest=language).text
            print(f"🤖 VetBot ({language}): {reply_src}")

        except sr.UnknownValueError:
            print("❌ Could not understand audio. Please repeat.")
        except sr.RequestError:
            print("⚠️ Could not request results; check your internet connection.")
            break