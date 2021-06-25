"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const { when } = require("jest-when");
const { addComment, deleteComment, execCommand } = require("./lib.js");
const { action } = require("./action.js");

jest.mock("@actions/core");
jest.mock("@actions/github");
jest.mock("./lib.js");

describe("action", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("default flow", async () => {
    execCommand.mockReturnValue({ isSuccess: true, output: "" });
    when(core.getInput).calledWith("directory").mockReturnValue("foo");

    await action();

    expect(execCommand.mock.calls.length).toBe(5);
    expect(execCommand.mock.calls).toEqual([
      ["terraform init", "foo"],
      ["terraform validate", "foo"],
      ["terraform fmt --check", "foo"],
      ["terraform plan -json -out=plan.tfplan", "foo"],
      ["terraform show plan.tfplan -no-color", "foo"],
    ]);
    expect(addComment.mock.calls.length).toBe(0);
    expect(deleteComment.mock.calls.length).toBe(0);
  });

  test("terragrunt flow", async () => {
    execCommand.mockReturnValue({ isSuccess: true, output: "" });
    when(core.getInput).calledWith("directory").mockReturnValue("bar");
    when(core.getInput).calledWith("terragrunt").mockReturnValue("true");

    await action();

    expect(execCommand.mock.calls.length).toBe(5);
    expect(execCommand.mock.calls).toEqual([
      ["terragrunt init", "bar"],
      ["terragrunt validate", "bar"],
      ["terragrunt fmt --check", "bar"],
      ["terragrunt plan -json -out=plan.tfplan", "bar"],
      ["terragrunt show plan.tfplan -no-color", "bar"],
    ]);
    expect(addComment.mock.calls.length).toBe(0);
    expect(deleteComment.mock.calls.length).toBe(0);
  });

  test("delete comment", async () => {
    execCommand.mockReturnValue({ isSuccess: true, output: "" });
    when(core.getInput).calledWith("comment-delete").mockReturnValue("true");
    when(core.getInput)
      .calledWith("comment-title")
      .mockReturnValue("blueberries");
    when(core.getInput).calledWith("github-token").mockReturnValue("mellow");
    github.getOctokit.mockReturnValue("octokit");
    github.context = "context";

    await action();

    expect(github.getOctokit.mock.calls.length).toBe(1);
    expect(deleteComment.mock.calls.length).toBe(1);
    expect(deleteComment.mock.calls[0]).toEqual([
      "octokit",
      "context",
      "blueberries",
    ]);
  });

  test("add comment", async () => {
    execCommand.mockReturnValue({
      isSuccess: true,
      output: '"type":"planned_change"',
    });
    when(core.getInput).calledWith("comment").mockReturnValue("true");
    when(core.getInput)
      .calledWith("comment-title")
      .mockReturnValue("raspberries");
    when(core.getInput).calledWith("github-token").mockReturnValue("mellow");
    github.getOctokit.mockReturnValue("octokit");
    github.context = "context";

    await action();

    expect(github.getOctokit.mock.calls.length).toBe(1);
    expect(addComment.mock.calls.length).toBe(1);
    expect(addComment.mock.calls[0]).toEqual([
      "octokit",
      "context",
      "raspberries",
      {
        fmt: { isSuccess: true, output: '"type":"planned_change"' },
        init: { isSuccess: true, output: '"type":"planned_change"' },
        plan: { isSuccess: true, output: '"type":"planned_change"' },
        show: { isSuccess: true, output: '"type":"planned_change"' },
        validate: { isSuccess: true, output: '"type":"planned_change"' },
      },
    ]);
  });

  test("failed command", async () => {
    execCommand.mockReturnValue({ isSuccess: false, output: "" });

    await action();

    expect(core.setFailed.mock.calls.length).toBe(1);
    expect(core.setFailed.mock.calls[0][0]).toBe("Terraform plan failed");
  });

  test("allowed to fail", async () => {
    execCommand.mockReturnValue({ isSuccess: false, output: "" });
    when(core.getInput).calledWith("allow-failure").mockReturnValue("true");
    when(core.getInput).calledWith("comment").mockReturnValue("false");
    when(core.getInput).calledWith("comment-delete").mockReturnValue("false");

    await action();

    expect(core.setFailed.mock.calls.length).toBe(0);
  });

  test("failed validation", async () => {
    when(core.getInput).calledWith("comment").mockReturnValue("true");
    when(core.getInput).calledWith("github-token").mockReturnValue("false");

    await action();

    expect(core.setFailed.mock.calls.length).toBe(1);
    expect(core.setFailed.mock.calls[0][0]).toBe(
      "You must pass a GitHub token to comment on PRs"
    );
  });
});
