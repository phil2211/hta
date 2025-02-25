import "./App.css";
import Chatbot, {
  FloatingActionButtonTrigger,
  InputBarTrigger,
  ModalView,
} from "mongodb-chatbot-ui";

function MyApp() {
  const suggestedPrompts = [
    "Do you have any information about clinical cancer research?",
    "Give me some insight about cost reduction in the healthcare industry."
  ];
  const initialMessageText =
    "Hello and welcome to the HTA AI system. How can I help you today?";
  return (
    <div className="main">
      <header className="main-header">
        <h1>Welcome to the HTA AI system</h1>
        <p>
        AI-Driven HTA Document Retrieval, Storage, and LLM-Powered Analysis for Affiliates.
        </p>
      </header>
      <Chatbot
        serverBaseUrl={import.meta.env.VITE_SERVER_BASE_URL}
        isExperimental={false}
      >
        <>
          <InputBarTrigger
            suggestedPrompts={suggestedPrompts}
            placeholder="What would you like to know?"
            className="input-bar"
          />
          <FloatingActionButtonTrigger text="Gilded Age Gourmet" />
          <ModalView
            initialMessageText={initialMessageText}
            initialMessageSuggestedPrompts={suggestedPrompts}
          />
        </>
      </Chatbot>
    </div>
  );
}

export default MyApp;
