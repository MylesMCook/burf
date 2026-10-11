Feature: Machine service inventory
  Burf shows the agents, dev servers, Docker containers and OS services on
  each machine it knows: this computer, paired computers, and machines it
  only inspects over SSH. It reports what it last read and how well it could
  read it. Services Burf did not start are read only.

  # Bound by scenario name in inventory.spec.ts, which fails when a scenario
  # here has no test of the same name.

  Scenario: Selecting a machine shows only that machine's services
    Given devl and this computer each report their own services
    When I open devl and view its services
    Then I see devl's services with their collector, status, health and ports
    And a service's details give its location
    And I see nothing that runs on this computer
    When I open this computer and view its services
    Then I see only what runs on this computer
    And nothing was scanned or changed by looking

  Scenario: A machine registered for SSH inspection cannot start chats or tasks
    Given no machine is inspected over SSH
    When I register nas for inspection over SSH from Paired computers
    Then setup says this reads services and does not install Burf's daemon
    And nas joins machine navigation as an SSH-only machine
    And its page lists its services
    And its page offers no chat, task or project control

  Scenario: An unreachable machine keeps its last-known services
    Given nas was read an hour ago with a running container
    When a new scan cannot reach nas
    Then the page says nas could not be reached, why, and that services may still be running
    And the container shows as last seen running an hour ago, not as stopped

  Scenario: A scan the agent cannot run keeps what was last read
    Given nas was read with a running container
    When Burf's agent refuses to scan
    Then the page says the scan could not run and why
    And the container is still listed as running

  Scenario: An unavailable collector is reported with its reason and age
    Given Docker cannot be read on devl while its other collectors succeed
    When I view devl's services
    Then Docker containers show as unavailable, with the reason and when it was checked
    And the container last seen there stays listed as last seen
    And services from the other collectors keep their current status
    And devl itself is not reported as unreachable

  Scenario: A service's history can be selected
    Given a dev server on devl failed after a gap in scans and came back
    When I select that dev server
    Then I see its details and its changes in order, with the gap marked
    And its process is shown by number alone, because the machine gave no start time
    When I select another service
    Then I see that service's history instead

  Scenario: An open history gains the change a scan records
    Given I have a dev server's history open on devl
    When a scan finds the dev server failed
    Then its status shows as failed
    And the new change joins the history already shown, without reopening it
    And only the changes after the last one shown are asked for

  Scenario: An SSH route is attached to an existing machine the person chooses
    Given devl is paired and nothing is inspected over SSH
    When I add an SSH route to devl from Paired computers
    Then an SSH target that would be read as an option is refused with the reason
    And devl keeps its paired route and gains the SSH route
    And no new machine is created

  Scenario: A paired computer is attached to a machine inspected over SSH
    Given nas is inspected over SSH and devl is paired
    And devl's page shows the services of devl's own record
    When I attach the paired computer devl to nas from Paired computers
    Then nas keeps its SSH route and gains the paired route
    And nas leaves the SSH-only machines in navigation
    When I open devl's page again
    Then it shows the services of nas, which now holds the pairing
    And nothing is asked of the record that held the pairing before

  Scenario: A scan's result is not replaced by an older answer that arrives late
    Given nas was read an hour ago with one container
    And the page's first read of nas has not been answered yet
    When I scan nas and the scan finds a second container
    And the first read is then answered with what was held an hour ago
    Then both containers are still listed as just seen

  Scenario: A backend without machine inventory leaves machine views as they were
    Given Burf's agent has no machine inventory
    When I open devl
    Then its worktrees and task controls work as before, with no services control
    And Paired computers says machine inventory is not available
