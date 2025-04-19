import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
// import { z } from "zod";

// Add these schemas at the top of the component
// const createSchema = z.object({
//   nickname: z.string().min(1, "Nickname is required"),
// });

// const joinSchema = z.object({
//   nickname: z.string().min(1, "Nickname is required"),
//   roomId: z
//     .string()
//     .length(6, "Room ID must be 6 characters")
//     .regex(/^[A-Z0-9]+$/, "Room ID must be uppercase letters and numbers"),
// });

// const gameSchema = z.object({
//   question: z.string().min(1, "Question is required"),
//   answer: z.string().min(1, "Answer is required"),
// });

// interface HomeState {
//   createErrors: z.inferFlattenedErrors<typeof createSchema>["fieldErrors"];
//   joinErrors: z.inferFlattenedErrors<typeof joinSchema>["fieldErrors"];
//   masterErrors: z.inferFlattenedErrors<typeof gameSchema>["fieldErrors"];
// }

interface Player {
  id: string;
  nicknsame: string;
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
  answer: string;
}
interface GameEndedData {
  answer: string;
}
interface GuessResponse {
  correct?: boolean;
  attemptsLeft: number;
}
type Step = "lobby" | "master" | "player" | "game";

// Reusable spinner
const Spinner: React.FC<{ size?: number }> = ({ size = 6 }) => (
  <div
    className={`
    w-${size} h-${size} border-4 border-t-transparent border-white
    rounded-full animate-spin
  `}
  />
);

const Home: React.FC = () => {
  // State
  const [step, setStep] = useState<Step>("lobby");
  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [guess, setGuess] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [scores, setScores] = useState<{ name: string; score: number }[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  // after your existing game state…
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [winnerName, setWinnerName] = useState<string>("");
  const [roundAnswer, setRoundAnswer] = useState<string>("");

  // Loaders
  const [isSocketLoading, setIsSocketLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  // const [isStarting, setIsStarting] = useState(false);
  const [isGuessing, setIsGuessing] = useState(false);

  // Validate input
  // const [createErrors, setCreateErrors] = useState<HomeState["createErrors"]>(
  //   {}
  // );
  // const [joinErrors, setJoinErrors] = useState<HomeState["joinErrors"]>({});
  // const [masterErrors] = useState<HomeState["masterErrors"]>({});

  // Initialize socket.io
  useEffect(() => {
    import("socket.io-client")
      .then(({ default: io }) => {
        const backendURL = process.env.NEXT_PUBLIC_API_BASE_URL!;
        const socket = io(backendURL, { transports: ["websocket"] });
        socketRef.current = socket;

        // Connection established
        socket.on("connect", () => setIsSocketLoading(false));

        // Player list & master flag
        socket.on("update_players", (list: Player[]) => {
          setPlayers(list);
          const me = list.find((p) => p.id === socket.id);
          setIsMaster(!!me?.isMaster);
        });

        // Chat updates
        socket.on("chat_update", (msgs: ChatMessage[]) => {
          setChat(msgs);
        });

        // Game started
        if (socketRef.current) {
          socketRef.current.on(
            "game_started",
            ({ question, answer }: GameStartedData) => {
              setQuestion(question);
              setAnswer(answer); // Store answer locally if needed
              setAttemptsLeft(3);
              setGuess("");
              setStep("game");
            }
          );
        }

        // Player won
        socket.on("game_won", (data: GameWonData) => {
          setScores(data.scores);
          setWinnerName(data.winner);
          setRoundAnswer(data.answer);
          setChat((c) => [
            ...c,
            {
              system: true,
              text: `${data.winner} won! Answer: ${data.answer}`,
            },
          ]);
          setGameOver(true);
        });

        // Time expired
        socket.on("game_ended", ({ answer }: GameEndedData) => {
          setRoundAnswer(answer);
          setChat((c) => [
            ...c,
            { system: true, text: `Time's up! Answer was: ${answer}` },
          ]);
          setGameOver(true);
        });

        // Cleanup on unmount
        return () => {
          socket.disconnect();
        };
      })
      .catch(console.error);
  }, []);

  // Auto‑scroll chat to bottom :contentReference[oaicite:14]{index=14}
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chat]);

  // Handlers with loaders
  const handleCreateRoom = () => {
    // const result = createSchema.safeParse({ nickname });
    // if (!result.success) {
    // setCreateErrors(result.error.flatten().fieldErrors);
    //   return;
    // }
    // setCreateErrors({});
    setIsCreating(true);
    socketRef.current?.emit(
      "create_room",
      { nickname },
      ({ roomId }: { roomId: string }) => {
        setIsCreating(false);
        setRoomId(roomId);
        setStep("master");
      }
    );
  };

  const handleJoinRoom = () => {
    // const result = joinSchema.safeParse({ nickname, roomId });
    // if (!result.success) {
    //   setJoinErrors(result.error.flatten().fieldErrors);
    //   return;
    // }
    // setJoinErrors({});
    setIsJoining(true);
    socketRef.current?.emit(
      "join_room",
      { roomId, nickname },
      (res: { error?: string; success?: boolean }) => {
        setIsJoining(false);
        if (res.error) {
          toast("Error Joining Room", {
            description: res.error,
            action: { label: "Try again", onClick: handleJoinRoom },
          });
          return;
        }
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
        toast("Error Starting Game", {
          description: res.error,
          action: {
            label: "Try again",
            onClick: () => {
              handleStartGame();
            },
          },
        });
      }
    );
  };

  const handleSubmitGuess = () => {
    setIsGuessing(true);
    socketRef.current?.emit(
      "submit_guess",
      { roomId, guess },
      (res: GuessResponse) => {
        setIsGuessing(false);
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

  // Full‑screen loader on WS init :contentReference[oaicite:15]{index=15}
  if (isSocketLoading) {
    return (
      <div className="flex justify-center items-center bg-gray-900 min-h-screen">
        <Spinner size={12} />
      </div>
    );
  }

  // Lobby UI
  if (step === "lobby") {
    return (
      <div className="flex flex-col justify-center items-center bg-gradient-to-br from-gray-900 to-gray-700 p-4 min-h-screen">
        <div className="space-y-6 bg-white/10 backdrop-blur-lg p-6 border border-white/20 rounded-xl w-full max-w-md">
          <h1 className="font-bold text-white text-3xl text-center">
            Guessing Game
          </h1>
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your nickname"
            className="bg-black/20 w-full text-white placeholder-gray-400"
          />
          {/* {createErrors.nickname && (
            <p className="mt-1 text-red-400 text-sm">
              {createErrors.nickname[0]}
            </p>
          )} */}
          <Button
            onClick={handleCreateRoom}
            disabled={!nickname || isCreating || isSocketLoading}
            className="bg-blue-500/90 hover:bg-blue-500 px-4 py-2 rounded-md w-full font-semibold text-white transition-colors duration-300"
          >
            {isCreating ? <Spinner /> : "Create Room"}
          </Button>
          <div className="border-white/20 border-t"></div>
          <Input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            placeholder="Room ID"
            maxLength={6}
            className="bg-black/20 w-full text-white placeholder-gray-400"
          />
          {/* {joinErrors.roomId && (
            <p className="mt-1 text-red-400 text-sm">{joinErrors.roomId[0]}</p>
          )} */}
          <Button
            onClick={handleJoinRoom}
            disabled={isSocketLoading || !nickname || !roomId || isJoining}
            className="bg-green-500/90 hover:bg-green-500 px-4 py-2 rounded-md w-full font-semibold text-white transition-colors duration-300"
          >
            {isJoining ? <Spinner /> : "Join Room"}
          </Button>
        </div>
        <div className="bottom-0 left-0 absolute flex justify-center opacity-50 w-[100%] font-bold text-[20px] text-white">
          by Nosakhare Victory Efosa
        </div>
      </div>
    );
  }

  // In‑Room & Game UI
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-4 min-h-screen">
      <div className="space-y-6 mx-auto max-w-[30rem]">
        <h2 className="font-semibold text-white text-2xl text-center">
          Room: <span className="text-blue-400">{roomId}</span> — Players:{" "}
          <span className="text-green-400">{players.length}</span>
        </h2>

        {/* Chat Window */}
        <div className="bg-white/5 backdrop-blur-lg p-4 border border-white/20 rounded-xl">
          <ScrollArea className="pr-4 h-72">
            <div className="space-y-2" ref={chatRef}>
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-2 rounded-lg",
                    m.system
                      ? "bg-gray-700/50 text-gray-300"
                      : m.you
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-gray-800/50 text-white"
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
          <div className="space-y-4 bg-white/10 backdrop-blur-lg p-6 border border-white/20 rounded-xl">
            <h3 className="font-semibold text-white text-lg">
              You’re the Game Master
            </h3>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Question"
              className="bg-black/20 w-full text-white placeholder-gray-400"
            />
            {/* {masterErrors.question && (
              <p className="mt-1 text-red-400 text-sm">
                {masterErrors.question[0]}
              </p>
            )} */}

            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Answer"
              className="bg-black/20 w-full text-white placeholder-gray-400"
            />
            {/* {masterErrors.answer && (
              <p className="mt-1 text-red-400 text-sm">
                {masterErrors.answer[0]}
              </p>
            )} */}
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
          <div className="bg-white/5 p-4 border border-white/20 rounded-xl text-white text-center">
            Waiting for the Game Master to start…
          </div>
        )}

        {/* Gameplay */}
        {step === "game" && (
          <div className="space-y-4 bg-white/10 backdrop-blur-lg p-6 border border-white/20 rounded-xl">
            <h3 className="font-semibold text-yellow-300 text-xl">
              Question: {question}
            </h3>

            {!gameOver ? (
              <div>
                <Input
                  value={guess}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setGuess(e.target.value)
                  }
                  placeholder="Your guess"
                  className="bg-black/20 w-full text-white placeholder-gray-400"
                />
                <Button
                  onClick={handleSubmitGuess}
                  disabled={!guess || isGuessing}
                  className="w-full"
                >
                  {isGuessing ? <Spinner /> : "Submit Guess"}
                </Button>
                <p className="text-white">
                  Attempts left:{" "}
                  <span className="text-red-400">{attemptsLeft}</span>
                </p>
              </div>
            ) : (
              <>
                {/* ← NEW: result panel */}
                <h4 className="text-white text-lg">
                  {winnerName
                    ? `${winnerName} guessed correctly!`
                    : `Time's up! Answer: ${roundAnswer}`}
                </h4>
                <div>
                  <ul className="text-white list-disc list-inside">
                    {scores.length > 0 && (
                      <div className="space-y-4 backdrop-blur-lg p-6 border border-white/20 rounded-xl">
                        <h3 className="font-semibold text-white text-lg">
                          Scores
                        </h3>
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
                  </ul>
                </div>
                <Button
                  onClick={() => {
                    setStep("lobby");
                    setGameOver(false);
                  }}
                  className="mt-4 w-full"
                >
                  Back to Lobby
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
