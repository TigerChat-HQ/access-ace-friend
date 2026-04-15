import { Story } from "@/types/chat";
import { Plus } from "lucide-react";

interface StoriesBarProps {
  stories: Story[];
  onStoryClick?: (index: number) => void;
  onAddStory?: () => void;
}

const StoryCircle = ({ story, onClick }: { story: Story; onClick: () => void }) => {
  const isMyStory = story.userId === "me";
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 min-w-[68px]">
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
    </button>
  );
};

export const StoriesBar = ({ stories, onStoryClick, onAddStory }: StoriesBarProps) => {
  return (
    <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-thin border-b border-border/50">
      {stories.map((story, i) => (
        <StoryCircle
          key={story.id}
          story={story}
          onClick={() => {
            if (story.userId === "me") {
              onAddStory?.();
            } else {
              onStoryClick?.(i - 1 >= 0 ? i - 1 : 0); // offset for "add" story
            }
          }}
        />
      ))}
    </div>
  );
};
