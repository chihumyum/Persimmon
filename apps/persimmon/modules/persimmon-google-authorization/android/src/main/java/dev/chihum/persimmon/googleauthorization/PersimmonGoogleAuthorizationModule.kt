package dev.chihum.persimmon.googleauthorization

import android.accounts.Account
import android.app.Activity
import android.content.IntentSender
import com.google.android.gms.auth.api.identity.AuthorizationClient
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.identity.RevokeAccessRequest
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Scope
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val AUTHORIZATION_REQUEST_CODE = 0x5047
private const val GOOGLE_ACCOUNT_TYPE = "com.google"

private const val ERROR_ACTIVITY_UNAVAILABLE = "E_ACTIVITY_UNAVAILABLE"
private const val ERROR_AUTHORIZATION_CANCELLED = "E_AUTHORIZATION_CANCELLED"
private const val ERROR_AUTHORIZATION_FAILED = "E_AUTHORIZATION_FAILED"
private const val ERROR_AUTHORIZATION_IN_PROGRESS = "E_AUTHORIZATION_IN_PROGRESS"
private const val ERROR_AUTHORIZATION_REQUIRED = "E_AUTHORIZATION_REQUIRED"
private const val ERROR_INVALID_REQUEST = "E_INVALID_REQUEST"
private const val ERROR_MODULE_DESTROYED = "E_MODULE_DESTROYED"
private const val ERROR_TOKEN_UNAVAILABLE = "E_TOKEN_UNAVAILABLE"

class PersimmonGoogleAuthorizationModule : Module() {
  private var activeAuthorizationClient: AuthorizationClient? = null
  private var activeAuthorizationPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("PersimmonGoogleAuthorization")

    AsyncFunction("authorize") {
      scopes: List<String>,
      accountEmail: String?,
      interactive: Boolean,
      promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject(
          ERROR_ACTIVITY_UNAVAILABLE,
          "Google authorization requires a foreground activity.",
          null
        )
        return@AsyncFunction
      }
      if (activeAuthorizationPromise != null) {
        promise.reject(
          ERROR_AUTHORIZATION_IN_PROGRESS,
          "Another Google authorization request is already in progress.",
          null
        )
        return@AsyncFunction
      }

      val requestedScopes = scopes.toGoogleScopes()
      if (requestedScopes.isEmpty()) {
        promise.reject(
          ERROR_INVALID_REQUEST,
          "At least one Google authorization scope is required.",
          null
        )
        return@AsyncFunction
      }

      val client = Identity.getAuthorizationClient(activity)
      val requestBuilder = AuthorizationRequest.builder()
        .setRequestedScopes(requestedScopes)
      accountEmail.toGoogleAccount()?.let(requestBuilder::setAccount)

      activeAuthorizationClient = client
      activeAuthorizationPromise = promise
      client.authorize(requestBuilder.build())
        .addOnSuccessListener { result ->
          if (!result.hasResolution()) {
            resolveAuthorization(result)
            return@addOnSuccessListener
          }
          if (!interactive) {
            rejectActiveAuthorization(
              ERROR_AUTHORIZATION_REQUIRED,
              "Google authorization requires user interaction.",
              null
            )
            return@addOnSuccessListener
          }

          val pendingIntent = result.pendingIntent
          if (pendingIntent == null) {
            rejectActiveAuthorization(
              ERROR_AUTHORIZATION_FAILED,
              "Google authorization returned no resolution intent.",
              null
            )
            return@addOnSuccessListener
          }
          try {
            activity.startIntentSenderForResult(
              pendingIntent.intentSender,
              AUTHORIZATION_REQUEST_CODE,
              null,
              0,
              0,
              0
            )
          } catch (error: IntentSender.SendIntentException) {
            rejectActiveAuthorization(
              ERROR_AUTHORIZATION_FAILED,
              "Unable to open Google authorization.",
              error
            )
          }
        }
        .addOnFailureListener(::rejectAuthorizationFailure)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("revoke") {
      scopes: List<String>,
      accountEmail: String?,
      promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(
          ERROR_ACTIVITY_UNAVAILABLE,
          "Google authorization context is unavailable.",
          null
        )
        return@AsyncFunction
      }
      val requestedScopes = scopes.toGoogleScopes()
      if (requestedScopes.isEmpty()) {
        promise.reject(
          ERROR_INVALID_REQUEST,
          "At least one Google authorization scope is required.",
          null
        )
        return@AsyncFunction
      }
      val requestBuilder = RevokeAccessRequest.builder().setScopes(requestedScopes)
      accountEmail.toGoogleAccount()?.let(requestBuilder::setAccount)
      Identity.getAuthorizationClient(context)
        .revokeAccess(requestBuilder.build())
        .addOnSuccessListener { promise.resolve() }
        .addOnFailureListener { error ->
          promise.reject(
            ERROR_AUTHORIZATION_FAILED,
            "Unable to revoke Google authorization.",
            error
          )
        }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("clearToken") { token: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(
          ERROR_ACTIVITY_UNAVAILABLE,
          "Google authorization context is unavailable.",
          null
        )
        return@AsyncFunction
      }
      if (token.isBlank()) {
        promise.reject(
          ERROR_INVALID_REQUEST,
          "A non-empty Google access token is required.",
          null
        )
        return@AsyncFunction
      }
      val request = ClearTokenRequest.builder().setToken(token).build()
      Identity.getAuthorizationClient(context)
        .clearToken(request)
        .addOnSuccessListener { promise.resolve() }
        .addOnFailureListener { error ->
          promise.reject(
            ERROR_AUTHORIZATION_FAILED,
            "Unable to clear the cached Google access token.",
            error
          )
        }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != AUTHORIZATION_REQUEST_CODE) {
        return@OnActivityResult
      }
      if (payload.resultCode == Activity.RESULT_CANCELED) {
        rejectActiveAuthorization(
          ERROR_AUTHORIZATION_CANCELLED,
          "Google authorization was cancelled.",
          null
        )
        return@OnActivityResult
      }
      val data = payload.data
      val client = activeAuthorizationClient
      if (data == null || client == null) {
        rejectActiveAuthorization(
          ERROR_AUTHORIZATION_FAILED,
          "Google authorization returned no result.",
          null
        )
        return@OnActivityResult
      }
      try {
        resolveAuthorization(client.getAuthorizationResultFromIntent(data))
      } catch (error: ApiException) {
        rejectAuthorizationFailure(error)
      }
    }

    OnDestroy {
      rejectActiveAuthorization(
        ERROR_MODULE_DESTROYED,
        "Google authorization was interrupted because the app runtime closed.",
        null
      )
    }
  }

  private fun resolveAuthorization(result: AuthorizationResult) {
    val token = result.accessToken
    if (token.isNullOrBlank()) {
      rejectActiveAuthorization(
        ERROR_TOKEN_UNAVAILABLE,
        "Google authorization returned no access token.",
        null
      )
      return
    }
    val promise = takeActiveAuthorizationPromise() ?: return
    promise.resolve(
      mapOf(
        "accessToken" to token,
        "grantedScopes" to result.grantedScopes
      )
    )
  }

  private fun rejectAuthorizationFailure(error: Exception) {
    val cancelled = error is ApiException &&
      error.statusCode == CommonStatusCodes.CANCELED
    rejectActiveAuthorization(
      if (cancelled) ERROR_AUTHORIZATION_CANCELLED else ERROR_AUTHORIZATION_FAILED,
      if (cancelled) {
        "Google authorization was cancelled."
      } else {
        "Google authorization failed${apiStatusSuffix(error)}."
      },
      error
    )
  }

  private fun rejectActiveAuthorization(code: String, message: String, cause: Throwable?) {
    takeActiveAuthorizationPromise()?.reject(code, message, cause)
  }

  private fun takeActiveAuthorizationPromise(): Promise? {
    val promise = activeAuthorizationPromise
    activeAuthorizationPromise = null
    activeAuthorizationClient = null
    return promise
  }
}

private fun List<String>.toGoogleScopes(): List<Scope> =
  asSequence()
    .map(String::trim)
    .filter(String::isNotEmpty)
    .distinct()
    .map(::Scope)
    .toList()

private fun String?.toGoogleAccount(): Account? =
  this?.trim()?.takeIf(String::isNotEmpty)?.let { Account(it, GOOGLE_ACCOUNT_TYPE) }

private fun apiStatusSuffix(error: Exception): String =
  if (error is ApiException) " (status ${error.statusCode})" else ""
