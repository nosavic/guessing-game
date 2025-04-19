import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Player {
  id: string;
  nickname: string;
  score: number;
  isMaster: boolean;
}

interface ChatMessage {
  system?: boolean;
  you?: boolean;
  user?: string;
  text: string;
}

interface GameWonData {
  winner: string;
  answer: string;
  scores: { name: string; score: number }[];
}

interface GameStartedData {
  question: string;
}

interface GameEndedData {
  answer: string;
}

interface GuessResponse {
  correct?: boolean;
  attemptsLeft: number;
}

// const socket: typeof Socket = io("http://localhost:4000"); // Remove direct import, use in useEffect

type Step = "lobby" | "master" | "player" | "game";

const Home = () => {
  const [step, setStep] = useState<Step>("lobby");
  const [nickname, setNickname] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [isMaster, setIsMaster] = useState<boolean>(false);
  const [question, setQuestion] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [guess, setGuess] = useState<string>("");
  const [attemptsLeft, setAttemptsLeft] = useState<number>(3);
  const [scores, setScores] = useState<{ name: string; score: number }[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null); // Use useRef for socket

  // loading states
  const [isSocketLoading, setIsSocketLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isGuessing, setIsGuessing] = useState(false);

  // loading states

  // Initialize socket.io connection
  useEffect(() => {
    // Dynamically import socket.io-client
    import("socket.io-client")
      .then((module) => {
        const io = module.default;
        socketRef.current = io("http://localhost:4000"); // Initialize socket

        // Socket event handlers (moved inside useEffect)
        socketRef.current.on("update_players", (list: Player[]) => {
          setPlayers(list);
          const me = list.find((p) => p.id === socketRef.current.id);
          setIsMaster(!!me?.isMaster);
        });

        socketRef.current.on("chat_update", (msgs: ChatMessage[]) => {
          setChat(msgs);
        });

        socketRef.current.on(
          "game_started",
          ({ question }: GameStartedData) => {
            setQuestion(question);
            setAttemptsLeft(3);
            setGuess("");
            setStep("game");
          }
        );

        socketRef.current.on("game_won", (data: GameWonData) => {
          setScores(data.scores);
          setChat((c) => [
            ...c,
            {
              system: true,
              text: `${data.winner} won! Answer: ${data.answer}`,
            },
          ]);
          setStep("lobby");
        });

        socketRef.current.on("game_ended", ({ answer }: GameEndedData) => {
          setChat((c) => [
            ...c,
            { system: true, text: `Time up! Answer was: ${answer}` },
          ]);
          setStep("lobby");
        });

        // Cleanup function to disconnect
        return () => {
          if (socketRef.current) {
            socketRef.current.disconnect();
          }
        };
      })
      .catch((error) => {
        console.error("Failed to load socket.io-client:", error);
        // Handle error (e.g., show a message to the user)
      });
  }, []); // Empty dependency array to ensure this runs only once on mount

  // Scroll chat on update
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chat]);

  // Handlers
  const handleCreateRoom = () => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      "create_room",
      { nickname },
      ({ roomId }: { roomId: string }) => {
        setRoomId(roomId);
        setStep("master");
      }
    );
  };

  const handleJoinRoom = () => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      "join_room",
      { roomId, nickname },
      (res: { error?: string; success?: boolean }) => {
        if (res.error) return alert(res.error);
        setStep("player");
      }
    );
  };

  const handleStartGame = () => {
    if (!socketRef.current) return;
    socketRef.current.emit("set_question", { roomId, question, answer });
    socketRef.current.emit(
      "start_game",
      { roomId },
      (res: { error?: string; success?: boolean }) => {
        if (res.error) alert(res.error);
      }
    );
  };

  const handleSubmitGuess = () => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      "submit_guess",
      { roomId, guess },
      (res: GuessResponse) => {
        if (res.correct === false) {
          setAttemptsLeft(res.attemptsLeft);
          setChat((c) => [
            ...c,
            { you: true, text: `Wrong. ${res.attemptsLeft} attempts left.` },
          ]);
        }
      }
    );
    setGuess("");
  };

  // Render Lobby
  if (step === "lobby") {
    return (
      <div className="flex flex-col justify-center items-center bg-gradient-to-br from-gray-900 to-gray-700 p-4 min-h-screen">
        <div className="space-y-6 bg-white/10 shadow-lg backdrop-blur-md p-6 border border-white/10 rounded-xl w-full max-w-md">
          <h1 className="font-bold text-white text-3xl text-center">
            Guessing Game
          </h1>
          <Input
            type="text"
            value={nickname}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setNickname(e.target.value)
            }
            placeholder="Your nickname"
            className="bg-black/20 border-gray-700 text-white placeholder:text-gray-400"
          />
          <Button
            onClick={handleCreateRoom}
            disabled={!nickname}
            className="bg-blue-500/90 hover:bg-blue-500 px-4 py-2 rounded-md w-full font-semibold text-white transition-colors duration-300"
          >
            Create Room
          </Button>
          <div className="my-4 border-gray-700 border-t" />
          <Input
            type="text"
            value={roomId}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setRoomId(e.target.value.toUpperCase())
            }
            placeholder="Room ID"
            maxLength={6}
            className="bg-black/20 border-gray-700 text-white placeholder:text-gray-400"
          />
          <Button
            onClick={handleJoinRoom}
            disabled={!nickname || !roomId}
            className="bg-green-500/90 hover:bg-green-500 px-4 py-2 rounded-md w-full font-semibold text-white transition-colors duration-300"
          >
            Join Room
          </Button>
        </div>
      </div>
    );
  }

  // In‑Room / Game UI
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-4 sm:p-6 lg:p-8 min-h-screen">
      <div className="space-y-6 mx-auto max-w-4xl">
        <h2 className="font-semibold text-white text-2xl text-center">
          Room: <span className="text-blue-400">{roomId}</span> &mdash; Players:{" "}
          <span className="text-green-400">{players.length}</span>
        </h2>

        {/* Chat Window */}
        <div className="bg-white/5 shadow-lg backdrop-blur-md border border-white/10 rounded-xl">
          <ScrollArea className="pr-4 rounded-md w-full h-72">
            <div className="space-y-2 p-4" ref={chatRef}>
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-2 rounded-lg",
                    m.system && "bg-gray-700/50 text-gray-300",
                    m.you && "bg-blue-500/20 text-blue-300",
                    !m.system && !m.you && "bg-gray-800/50 text-white"
                  )}
                >
                  {m.system
                    ? m.text
                    : m.you
                    ? `You: ${m.text}`
                    : `${m.user || ""}${m.user ? ": " : ""}${m.text}`}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Master Controls */}
        {isMaster && step !== "game" && (
          <div className="space-y-4 bg-white/10 shadow-lg backdrop-blur-md p-6 border border-white/10 rounded-xl">
            <h3 className="font-semibold text-white text-lg">
              You’re the Game Master
            </h3>
            <Input
              type="text"
              value={question}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setQuestion(e.target.value)
              }
              placeholder="Question"
              className="bg-black/20 border-gray-700 text-white placeholder:text-gray-400"
            />
            <Input
              type="text"
              value={answer}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setAnswer(e.target.value)
              }
              placeholder="Answer"
              className="bg-black/20 border-gray-700 text-white placeholder:text-gray-400"
            />
            <Button
              onClick={handleStartGame}
              disabled={!question || !answer}
              className="bg-purple-500/90 hover:bg-purple-500 px-4 py-2 rounded-md w-full font-semibold text-white transition-colors duration-300"
            >
              Start Game
            </Button>
          </div>
        )}

        {/* Waiting for Master */}
        {!isMaster && step === "player" && (
          <p className="bg-white/5 shadow-lg backdrop-blur-md p-4 border border-white/10 rounded-xl text-white text-center">
            Waiting for the game master to start the game…
          </p>
        )}

        {/* Gameplay */}
        {step === "game" && (
          <div className="space-y-4 bg-white/10 shadow-lg backdrop-blur-md p-6 border border-white/10 rounded-xl">
            <h3 className="font-semibold text-yellow-300 text-xl">
              Question: {question}
            </h3>
            <Input
              type="text"
              value={guess}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setGuess(e.target.value)
              }
              placeholder="Your guess"
              className="bg-black/20 border-gray-700 text-white placeholder:text-gray-400"
            />
            <Button
              onClick={handleSubmitGuess}
              disabled={!guess}
              className="bg-orange-500/90 hover:bg-orange-500 px-4 py-2 rounded-md w-full font-semibold text-white transition-colors duration-300"
            >
              Guess
            </Button>
            <p className="text-white">
              Attempts left:{" "}
              <span className="text-red-400">{attemptsLeft}</span>
            </p>
          </div>
        )}

        {/* Scoreboard */}
        {scores.length > 0 && (
          <div className="space-y-4 bg-white/10 shadow-lg backdrop-blur-md p-6 border border-white/10 rounded-xl">
            <h3 className="font-semibold text-white text-lg">Scores</h3>
            <ul className="space-y-2">
              {scores.map((s) => (
                <li key={s.name} className="text-white">
                  <span className="font-medium">{s.name}:</span>{" "}
                  <span className="text-blue-300">{s.score}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;

const Spinner: React.FC<{ size?: number }> = ({ size = 6 }) => (
  <div
    className={`w-${size} h-${size} border-4 border-t-transparent border-white rounded-full animate-spin`}
  />
);
