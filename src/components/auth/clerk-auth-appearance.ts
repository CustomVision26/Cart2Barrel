import type { SignIn } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type ClerkAuthAppearance = NonNullable<
  ComponentProps<typeof SignIn>["appearance"]
>;

export const clerkAuthCardAppearance: ClerkAuthAppearance = {
  elements: {
    rootBox: "mx-auto w-full max-w-[420px]",
    card: "shadow-xl ring-1 ring-border/60",
  },
};
