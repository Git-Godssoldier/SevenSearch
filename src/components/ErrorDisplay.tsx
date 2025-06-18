interface ErrorDisplayProps {
  message: string;
}

export default function ErrorDisplay({ message }: ErrorDisplayProps) {
  return <p className="text-center text-red-500">{message}</p>;
}
