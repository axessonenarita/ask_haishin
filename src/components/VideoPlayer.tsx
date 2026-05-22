type Props = { embedUrl: string | undefined };

export function VideoPlayer({ embedUrl }: Props) {
  if (!embedUrl) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-black text-neutral-500">
        配信URLが未設定です
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full bg-black">
      <iframe
        src={embedUrl}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
        title="ライブ配信"
      />
    </div>
  );
}
