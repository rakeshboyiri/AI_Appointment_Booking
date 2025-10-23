import { useState, useEffect } from "react";
import { vapi, startAssistant, stopAssistant } from "./ai";
import ActiveCallDetails from "./call/ActiveCallDetails";
import MicButton from "./call/MicButton";

function App() {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assistantIsSpeaking, setAssistantIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [callId, setCallId] = useState("");
  const [callResult, setCallResult] = useState(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Set up VAPI event listeners
    const setupVapiListeners = () => {
      vapi
        .on("call-start", (data) => {
          // console.log("Call started:", data);
          // if (data?.id) {
          //   setCallId(data.id);
          // }
          setLoading(false);
          setStarted(true);
          setError(null);
        })
        .on("call-end", () => {
          console.log("Call ended");
          setStarted(false);
          setLoading(false);
          if (callId) {
            getCallDetails();
          }
        })
        .on("speech-start", () => {
          console.log("Assistant started speaking");
          setAssistantIsSpeaking(true);
        })
        .on("speech-end", () => {
          console.log("Assistant stopped speaking");
          setAssistantIsSpeaking(false);
        })
        .on("volume-level", (level) => {
          setVolumeLevel(level);
        })
        .on("error", (error) => {
          console.error("VAPI error:", error);
          setError(
            error.message || "An error occurred with the voice assistant"
          );
          setLoading(false);
          setStarted(false);
        });
    };

    setupVapiListeners();

    // Cleanup function
    return () => {
      vapi.removeAllListeners();
    };
  }, [callId]); // Add callId as dependency since we use it in the callback

  const handleStart = async () => {
    setIsRecording(true);
    try {
      setLoading(true);
      setError(null);
      const response = await startAssistant();
      console.log("Assistant started with response:", response);
      setCallId(response);
    } catch (error) {
      console.error("Error starting assistant:", error);
      setError(error.message || "Failed to start the voice assistant");
      setLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      await stopAssistant();
      // getCallDetails will be called by the call-end event
    } catch (error) {
      console.error("Error stopping assistant:", error);
      setError(error.message || "Failed to stop the voice assistant");
    }
  };

  const getCallDetails = (interval = 3000) => {
    if (!callId) return;

    setLoadingResult(true);
    setError(null);

    fetch("https://ai-powered-voice-based-appointment.onrender.com/call-details?call_id=" + callId)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.analysis) {
          console.log("Call details received:", data.analysis.structuredData);
          console.log("Call details received:", data.analysis.appointment);
          setCallResult(data);
          setLoadingResult(false);
        } else {
          console.log("Waiting for call details...");
          setTimeout(() => getCallDetails(interval), interval);
        }
      })
      .catch((error) => {
        console.error("Error fetching call details:", error);
        setError(error.message || "Failed to fetch call details");
        setLoadingResult(false);
      });
  };

  // Add this useEffect to handle recording state
  useEffect(() => {
    if (!callId) {
      setIsRecording(false);
    }
  }, [callId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-primary to-primary p-6 md:p-8 lg:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="bg-secondary-dark/30 backdrop-blur-lg rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              AI Voice Assistant
            </h1>
            <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto">
              Your intelligent appointment scheduling assistant
            </p>
          </div>

          {/* Instructions Section */}
          {!started && !loading && !loadingResult && !callResult && (
            <div className="instructions">
              <h2>How to Use</h2>
              <ul>
                <li>Click the microphone button below to start your conversation</li>
                <li>Speak clearly about the appointment you'd like to schedule</li>
                <li>Include your name, email, preferred date, and time</li>
                <li>The AI will guide you through the scheduling process</li>
              </ul>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-6 py-4 rounded-lg mb-6">
              <p className="font-medium">Error: {error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
              <p className="text-white text-lg">Initializing voice assistant...</p>
            </div>
          )}

          {/* Start Call Button */}
          {!started && !loading && !loadingResult && !callResult && (
            <MicButton 
              isRecording={isRecording}
              onClick={handleStart}
            />
          )}

          {/* Active Call Details */}
          {started && callId && (
            <ActiveCallDetails
              assistantIsSpeaking={assistantIsSpeaking}
              volumeLevel={volumeLevel}
              endCallCallback={handleStop}
            />
          )}

          {/* Call Results */}
          {!loadingResult && callResult && (
            <div className="bg-secondary-dark/50 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6">
              <h2 className="text-xl md:text-2xl font-semibold text-white mb-4 md:mb-6">
                Interview Details
              </h2>
              <div className="overflow-hidden rounded-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <tbody className="divide-y divide-secondary-dark/60">
                      <tr className="hover:bg-secondary-dark/40 transition-colors">
                        <td className="py-3 md:py-4 px-4 md:px-6 text-secondary font-medium whitespace-nowrap">
                          Name:
                        </td>
                        <td className="py-3 md:py-4 px-4 md:px-6 text-white break-words">
                          {callResult.analysis.structuredData.name}
                        </td>
                      </tr>
                      <tr className="hover:bg-secondary-dark/40 transition-colors">
                        <td className="py-3 md:py-4 px-4 md:px-6 text-secondary font-medium whitespace-nowrap">
                          Email:
                        </td>
                        <td className="py-3 md:py-4 px-4 md:px-6 text-white break-words">
                          {callResult.analysis.structuredData.email}
                        </td>
                      </tr>
                      <tr className="hover:bg-secondary-dark/40 transition-colors">
                        <td className="py-3 md:py-4 px-4 md:px-6 text-secondary font-medium whitespace-nowrap">
                          Date:
                        </td>
                        <td className="py-3 md:py-4 px-4 md:px-6 text-white">
                          <div className="break-words">
                            {callResult.analysis.structuredData.displayDate?.relative || callResult.analysis.structuredData.date}
                          </div>
                          {callResult.analysis.structuredData.displayDate?.formatted && (
                            <div className="text-gray-400 text-sm mt-1">
                              {callResult.analysis.structuredData.displayDate.formatted}
                            </div>
                          )}
                        </td>
                      </tr>
                      <tr className="hover:bg-secondary-dark/40 transition-colors">
                        <td className="py-3 md:py-4 px-4 md:px-6 text-secondary font-medium whitespace-nowrap">
                          Time:
                        </td>
                        <td className="py-3 md:py-4 px-4 md:px-6 text-white break-words">
                          {callResult.analysis.structuredData.time}
                        </td>
                      </tr>
                      <tr className="hover:bg-secondary-dark/40 transition-colors">
                        <td className="py-3 md:py-4 px-4 md:px-6 text-secondary font-medium whitespace-nowrap">
                          Purpose:
                        </td>
                        <td className="py-3 md:py-4 px-4 md:px-6 text-white break-words">
                          {callResult.analysis.structuredData.purpose}
                        </td>
                      </tr>
                      <tr className="hover:bg-secondary-dark/40 transition-colors">
                        <td className="py-3 md:py-4 px-4 md:px-6 text-secondary font-medium whitespace-nowrap">
                          Call ID:
                        </td>
                        <td className="py-3 md:py-4 px-4 md:px-6 text-white break-words">
                          {callId}
                        </td>
                      </tr>
                      {callResult.analysis.structuredData.calendarLink && (
                        <tr className="hover:bg-secondary-dark/40 transition-colors">
                          <td className="py-3 md:py-4 px-4 md:px-6 text-secondary font-medium whitespace-nowrap">
                            Calendar Event:
                          </td>
                          <td className="py-3 md:py-4 px-4 md:px-6 text-white break-words">
                            <a 
                              href={callResult.analysis.structuredData.calendarLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 underline"
                            >
                              View in Google Calendar
                            </a>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Loading Overlay */}
          {(loading || loadingResult) && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-primary-light border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
