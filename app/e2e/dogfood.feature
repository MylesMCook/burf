Feature: Everyday Burf workflows remain usable

  People can configure computers and inspect work without losing controls
  to small windows or background activity.

  Scenario: Worktree filters and sorting fit a small desktop window
    Given my worktrees are shown in a small supported desktop window
    When I filter and sort my worktrees
    Then every filter and sorting control remains reachable

  Scenario: Background loops start compact while preserving their actions
    Given a background loop is running and I have not chosen a panel size
    When I open settings
    Then loop progress does not cover the settings
    And I can expand its details and return to the compact view

  Scenario: An automation opens with the keyboard without toggling it
    Given an existing enabled automation
    When I activate its row with Space
    Then its editor opens and the automation remains enabled

  Scenario: Computer setup explains its scope
    Given I can already start chats on this computer
    When I add a computer
    Then setup explains hosting agents and inspecting services as distinct choices

  Scenario: Wide service records keep inventory controls inside their sheet
    Given a machine reports services with many ports
    When I inspect its services
    Then the scan control stays inside the sheet
    And wide service tables scroll within the inventory

  Scenario: Search results keep their computer identity visible
    Given my tasks run on different computers
    When I search from a small desktop window
    Then each result keeps its computer identity inside the palette

  Scenario: Known database listeners do not promise a web page
    Given a known database process is listening on a computer
    When I inspect its server entry
    Then I can copy its address without a browser action
    And a refused clipboard action gives me a way to copy it manually
    And unknown and debug-enabled web listeners remain openable
