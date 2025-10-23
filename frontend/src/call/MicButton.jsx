import { FaMicrophone } from 'react-icons/fa';
import './MicButton.css';

const MicButton = ({ isRecording, onClick }) => {
  return (
    <div className="text-center">
      <button
        onClick={onClick}
        className={`mic-button ${isRecording ? 'recording' : ''}`}
        aria-label="Start Call"
      >
        {isRecording && <div className="mic-ripple"></div>}
        <FaMicrophone className="mic-icon" />
      </button>
      <p className="text-white text-lg mt-4">
        Click the microphone to start your call
      </p>
    </div>
  );
};

export default MicButton; 