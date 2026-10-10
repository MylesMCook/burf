import type * as React from "react";
import { MessagesSquare } from "lucide-react";
import * as stylex from "@stylexjs/stylex";

import { GitHubIcon } from "@/components/icons/github";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ThreadList } from "@/components/assistant-ui/elements/thread-list.aui";
import { radius } from "@/styles/tokens.stylex";
import { mark } from "./surfaces";

const styles = stylex.create({
  row: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  tile: {
    display: "flex",
    aspectRatio: "1",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: "var(--sidebar-primary)",
    color: "var(--sidebar-primary-foreground)",
  },
  icon: { width: 16, height: 16 },
  heading: { display: "flex", flexDirection: "column", gap: 2, lineHeight: 1 },
  headingEnd: { marginInlineEnd: 24 },
  title: { fontWeight: 600 },
});

export function ThreadListSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader marker="aui-sidebar-header" rule>
        <div {...mark("aui-sidebar-header-content", styles.row)}>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<a
                  href="https://assistant-ui.com"
                  target="_blank"
                  rel="noopener noreferrer"
                />}>
                  <div {...mark("aui-sidebar-header-icon-wrapper", styles.tile)}>
                    <MessagesSquare {...mark("aui-sidebar-header-icon", styles.icon)} />
                  </div>
                  <div {...mark("aui-sidebar-header-heading", styles.heading, styles.headingEnd)}>
                    <span {...mark("aui-sidebar-header-title", styles.title)}>
                      assistant-ui
                    </span>
                  </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarHeader>
      <SidebarContent marker="aui-sidebar-content" pad>
        <ThreadList />
      </SidebarContent>
      {props.collapsible !== "none" && <SidebarRail />}
      <SidebarFooter marker="aui-sidebar-footer" rule>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a
                href="https://github.com/assistant-ui/assistant-ui"
                target="_blank"
                rel="noopener noreferrer"
              />}>
                <div {...mark("aui-sidebar-footer-icon-wrapper", styles.tile)}>
                  <GitHubIcon className={mark("aui-sidebar-footer-icon", styles.icon).className} />
                </div>
                <div {...mark("aui-sidebar-footer-heading", styles.heading)}>
                  <span {...mark("aui-sidebar-footer-title", styles.title)}>
                    GitHub
                  </span>
                  <span>View Source</span>
                </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
