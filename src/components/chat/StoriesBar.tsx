import { Story } from "@/types/chat";
import { Plus } from "lucide-react";

interface StoriesBarProps {
  stories: Story[];
}

const StoryCircle = ({ story }: { story: Story }) => {
  const isMyStory = story.userId === "me";
  return (
    <div className="flex flex-col items-center gap-1 min-w-[68px]">
      <div className={`relative w-14 h-14 rounded-full p-[2px] ${
        story.viewed
          ? "bg-muted"
          : "bg-gradient-to-br from-neon-green via-neon-blue to-neon-purple"
      }`}>
        <div className="w-full h-full rounded-full bg-background flex items-center justify-center text-xs font-semibold text-foreground">
          {isMyStory ? (
            <Plus className="w-5 h-5 text-primary" />
          ) : (
            story.avatar
          )}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground truncate w-full text-center">
        {story.userName}
      </span>
    </div>
  );
};

export const StoriesBar = ({ stories }: StoriesBarProps) => {
  return (
    <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-thin border-b border-border/50">
      {stories.map((story) => (
        <StoryCircle key={story.id} story={story} />
      ))}
    </div>
  );
};
