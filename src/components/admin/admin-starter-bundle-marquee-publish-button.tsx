"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { adminSetStarterBundleMarqueePublishedAction } from "@/actions/admin-starter-bundles";
import { Button } from "@/components/ui/button";

export function AdminStarterBundleMarqueePublishButton({
  published,
  canPublish,
}: {
  published: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant={published ? "outline" : "default"}
      disabled={pending || (!published && !canPublish)}
      aria-pressed={published}
      title={
        published
          ? "Hide the Starter Bundles marquee from Home"
          : canPublish
            ? "Show the Starter Bundles marquee on Home"
            : "Publish at least one bundle first"
      }
      onClick={() => {
        startTransition(async () => {
          const res = await adminSetStarterBundleMarqueePublishedAction({
            published: !published,
          });
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
          toast.success(
            res.published
              ? "Starter Bundles marquee is on Home."
              : "Starter Bundles marquee is hidden from Home.",
          );
          router.refresh();
        });
      }}
    >
      {pending ? "Saving…" : "Published"}
    </Button>
  );
}
