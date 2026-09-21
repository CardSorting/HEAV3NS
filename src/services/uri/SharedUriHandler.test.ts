import { expect } from "chai"
import { afterEach, beforeEach, describe, it } from "mocha"
import * as sinon from "sinon"
import { WebviewProvider } from "@/core/webview"
import { Logger } from "@/shared/services/Logger"
import { ErrorService } from "../error"
import { SharedUriHandler } from "./SharedUriHandler"

	describe("SharedUriHandler", () => {
	let sandbox: sinon.SinonSandbox
	let handleAuthCallbackStub: sinon.SinonStub

	beforeEach(async () => {
		sandbox = sinon.createSandbox()

		// Mock Logger methods to avoid HostProvider dependency
		sandbox.stub(Logger, "info").returns()
		sandbox.stub(Logger, "error").returns()
		// Mock ErrorService to avoid telemetry dependency
		const mockErrorService = {
			logMessage: sandbox.stub(),
			logException: sandbox.stub(),
			toDietCodeError: sandbox.stub(),
			isEnabled: sandbox.stub().returns(false),
			getSettings: sandbox.stub().returns({ enabled: false, hostEnabled: false }),
			getProvider: sandbox.stub(),
			dispose: sandbox.stub().resolves(),
		}
		sandbox.stub(ErrorService, "initialize").resolves(mockErrorService as any)
		sandbox.stub(ErrorService, "get").returns(mockErrorService as any)

		await ErrorService.initialize()

		handleAuthCallbackStub = sandbox.stub().resolves()
		const mockWebviewProvider = {
			controller: {
				handleAuthCallback: handleAuthCallbackStub,
			},
		} as any
		sandbox.stub(WebviewProvider, "getVisibleInstance").returns(mockWebviewProvider)
	})

	afterEach(() => {
		sandbox.restore()
	})

	describe("handleUri", () => {
		describe("Auth callback handling", () => {
			it("should successfully handle auth callback with idToken", async () => {
				const result = await SharedUriHandler.handleUri("vscode://dietcode.dietcode/auth?idToken=jwt123&provider=google")

				expect(result).to.be.true
				sinon.assert.calledOnceWithExactly(handleAuthCallbackStub, "jwt123", "google", null)
			})

			it("should successfully handle auth callback without provider", async () => {
				const result = await SharedUriHandler.handleUri("vscode://dietcode.dietcode/auth?idToken=jwt123")

				expect(result).to.be.true
				sinon.assert.calledOnceWithExactly(handleAuthCallbackStub, "jwt123", null, null)
			})

			it("should return false when idToken is missing", async () => {
				const result = await SharedUriHandler.handleUri("vscode://dietcode.dietcode/auth?provider=google")

				expect(result).to.be.false
				expect(handleAuthCallbackStub.called).to.be.false
			})
		})

		describe("Unknown path handling", () => {
			it("should return false for unknown paths", async () => {
				const result = await SharedUriHandler.handleUri("vscode://dietcode.dietcode/unknown?param=value")

				expect(result).to.be.false
				expect(handleAuthCallbackStub.called).to.be.false
			})
		})

		describe("Error handling", () => {
			it("should catch and log errors from controller methods", async () => {
			const result = await SharedUriHandler.handleUri("vscode://dietcode.dietcode/requesty?code=test123")

				expect(result).to.be.false
			})

			it("should handle malformed URIs gracefully", async () => {
				const result = await SharedUriHandler.handleUri("invalid://uri")

				expect(result).to.be.false
				expect(handleAuthCallbackStub.called).to.be.false
			})
		})

		describe("Query parameter parsing", () => {
			it("should correctly parse multiple query parameters", async () => {
				const result = await SharedUriHandler.handleUri(
					"vscode://dietcode.dietcode/auth?idToken=jwt123&provider=github&extra=param",
				)

				expect(result).to.be.true
				sinon.assert.calledOnceWithExactly(handleAuthCallbackStub, "jwt123", "github", null)
			})

			it("should handle URL-encoded parameters", async () => {
				const result = await SharedUriHandler.handleUri(
					"vscode://dietcode.dietcode/auth?idToken=jwt%20with%20spaces&provider=google",
				)

				expect(result).to.be.true
				// URLSearchParams should decode %20 to spaces
				sinon.assert.calledOnceWithExactly(handleAuthCallbackStub, "jwt with spaces", "google", null)
			})

			it("should handle empty query string", async () => {
				const result = await SharedUriHandler.handleUri("vscode://dietcode.dietcode/requesty")

				expect(result).to.be.false
				expect(handleAuthCallbackStub.called).to.be.false
			})
		})

		describe("Different URI schemes", () => {
			it("should handle HTTP scheme URIs", async () => {
			const result = await SharedUriHandler.handleUri("http://localhost:3000/requesty?code=test123")

				expect(result).to.be.true
			})

			it("should handle HTTPS scheme URIs", async () => {
				const result = await SharedUriHandler.handleUri("https://example.com/auth?idToken=jwt123&provider=github")

				expect(result).to.be.true
				sinon.assert.calledOnceWithExactly(handleAuthCallbackStub, "jwt123", "github", null)
			})
		})
	})
})
