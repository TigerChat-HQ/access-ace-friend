package com.tigerchats.app

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.Camera2Enumerator
import org.webrtc.CameraVideoCapturer
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import org.webrtc.VideoSink
import org.webrtc.audio.JavaAudioDeviceModule

/**
 * Native WebRTC media/peer engine for the Android APK.
 *
 * Signaling remains owned by the TypeScript layer (Supabase Realtime). This class
 * only captures native devices and performs the peer-connection operations requested
 * by the WebView bridge. All events are returned to JavaScript as JSON.
 */
internal class NativeWebRtcEngine(
    context: Context,
    private val emit: (String, JSONObject) -> Unit,
) {
    private val appContext = context.applicationContext
    private val eglBase = EglBase.create()
    private val factory: PeerConnectionFactory
    private var peerConnection: PeerConnection? = null
    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var cameraCapturer: CameraVideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var localVideoEnabled = true
    private var facingFront = true
    private var localVideoSink: VideoSink? = null
    private var remoteVideoSink: VideoSink? = null
    private var remoteVideoTrack: VideoTrack? = null

    val eglContext: EglBase.Context get() = eglBase.eglBaseContext

    init {
        val options = PeerConnectionFactory.InitializationOptions.builder(appContext)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)
        val audioDeviceModule = JavaAudioDeviceModule.builder(appContext).createAudioDeviceModule()
        factory = PeerConnectionFactory.builder()
            .setAudioDeviceModule(audioDeviceModule)
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
            .createPeerConnectionFactory()
    }

    @Synchronized
    fun start(iceServersJson: String, withVideo: Boolean) {
        close()
        try {
            val servers = parseIceServers(JSONArray(iceServersJson))
            val config = PeerConnection.RTCConfiguration(servers).apply {
                sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
                continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
            }
            peerConnection = factory.createPeerConnection(config, observer())
                ?: throw IllegalStateException("Android WebRTC haikuweza kuunda PeerConnection.")
            audioSource = factory.createAudioSource(MediaConstraints())
            audioTrack = factory.createAudioTrack("tiger_native_audio", audioSource).also {
                peerConnection?.addTrack(it, listOf("tiger_native_stream"))
            }
            if (withVideo) startCamera()
            emit("ready", JSONObject().put("video", withVideo))
        } catch (error: Exception) {
            emitError("start", error)
            close()
        }
    }

    private fun startCamera() {
        val enumerator = Camera2Enumerator(appContext)
        val deviceName = (if (facingFront) enumerator.deviceNames.firstOrNull { enumerator.isFrontFacing(it) }
            else enumerator.deviceNames.firstOrNull { enumerator.isBackFacing(it) })
            ?: throw IllegalStateException("Camera haikupatikana.")
        cameraCapturer = enumerator.createCapturer(deviceName, null)
            ?: throw IllegalStateException("Imeshindikana kuanzisha camera.")
        surfaceTextureHelper = SurfaceTextureHelper.create("TigerWebRtcCapture", eglBase.eglBaseContext)
        videoSource = factory.createVideoSource(cameraCapturer!!.isScreencast)
        cameraCapturer!!.initialize(surfaceTextureHelper, appContext, videoSource!!.capturerObserver)
        cameraCapturer!!.startCapture(1280, 720, 30)
        videoTrack = factory.createVideoTrack("tiger_native_video", videoSource).also {
            peerConnection?.addTrack(it, listOf("tiger_native_stream"))
            localVideoSink?.let(it::addSink)
        }
    }

    fun createOffer() = createDescription(offer = true)
    fun createAnswer() = createDescription(offer = false)

    private fun createDescription(offer: Boolean) {
        val pc = peerConnection ?: return emitError("sdp", IllegalStateException("Native call haijaanzishwa."))
        val observer = object : SdpObserver {
            override fun onCreateSuccess(description: SessionDescription) {
                pc.setLocalDescription(object : SdpObserver {
                    override fun onSetSuccess() {
                        emit("local-description", JSONObject().put("type", description.type.canonicalForm()).put("sdp", description.description))
                    }
                    override fun onSetFailure(error: String) = emitError("set-local-sdp", IllegalStateException(error))
                    override fun onCreateSuccess(description: SessionDescription) = Unit
                    override fun onCreateFailure(error: String) = Unit
                }, description)
            }
            override fun onSetSuccess() = Unit
            override fun onCreateFailure(error: String) = emitError("create-sdp", IllegalStateException(error))
            override fun onSetFailure(error: String) = emitError("set-sdp", IllegalStateException(error))
        }
        if (offer) pc.createOffer(observer, MediaConstraints()) else pc.createAnswer(observer, MediaConstraints())
    }

    fun setRemoteDescription(type: String, sdp: String) {
        val parsedType = when (type.lowercase()) {
            "offer" -> SessionDescription.Type.OFFER
            "answer" -> SessionDescription.Type.ANSWER
            else -> return emitError("remote-sdp", IllegalArgumentException("Aina ya SDP si sahihi."))
        }
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onSetSuccess() { emit("remote-description-set", JSONObject()) }
            override fun onSetFailure(error: String) = emitError("remote-sdp", IllegalStateException(error))
            override fun onCreateSuccess(description: SessionDescription) = Unit
            override fun onCreateFailure(error: String) = Unit
        }, SessionDescription(parsedType, sdp))
    }

    fun addIceCandidate(json: String) {
        try {
            val value = JSONObject(json)
            val candidate = IceCandidate(
                value.optString("sdpMid").takeIf { it.isNotBlank() },
                value.optInt("sdpMLineIndex"),
                value.getString("candidate"),
            )
            if (peerConnection?.addIceCandidate(candidate) != true) {
                emitError("ice", IllegalStateException("ICE candidate imekataliwa."))
            }
        } catch (error: Exception) { emitError("ice", error) }
    }

    fun setAudioEnabled(enabled: Boolean) { audioTrack?.setEnabled(enabled) }
    fun setVideoEnabled(enabled: Boolean) {
        localVideoEnabled = enabled
        videoTrack?.setEnabled(enabled)
    }

    @Synchronized
    fun attachRenderers(localSink: VideoSink?, remoteSink: VideoSink?) {
        localVideoSink?.let { sink -> videoTrack?.removeSink(sink) }
        remoteVideoSink?.let { sink -> remoteVideoTrack?.removeSink(sink) }
        localVideoSink = localSink
        remoteVideoSink = remoteSink
        localSink?.let { sink -> videoTrack?.addSink(sink) }
        remoteSink?.let { sink -> remoteVideoTrack?.addSink(sink) }
    }

    @Synchronized
    fun switchCamera() {
        val capturer = cameraCapturer ?: return
        capturer.switchCamera(object : CameraVideoCapturer.CameraSwitchHandler {
            override fun onCameraSwitchDone(isFrontCamera: Boolean) {
                facingFront = isFrontCamera
                emit("camera-switched", JSONObject().put("front", isFrontCamera))
            }
            override fun onCameraSwitchError(error: String) = emitError("camera-switch", IllegalStateException(error))
        })
    }

    private fun observer() = object : PeerConnection.Observer {
        override fun onSignalingChange(state: PeerConnection.SignalingState) {
            emit("signaling-state", JSONObject().put("state", state.name))
        }
        override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
            emit("ice-state", JSONObject().put("state", state.name))
        }
        override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
        override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {
            emit("ice-gathering-state", JSONObject().put("state", state.name))
        }
        override fun onIceCandidate(candidate: IceCandidate) {
            emit("ice-candidate", JSONObject()
                .put("sdpMid", candidate.sdpMid)
                .put("sdpMLineIndex", candidate.sdpMLineIndex)
                .put("candidate", candidate.sdp))
        }
        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) = Unit
        override fun onAddStream(stream: org.webrtc.MediaStream) = Unit
        override fun onRemoveStream(stream: org.webrtc.MediaStream) = Unit
        override fun onDataChannel(channel: org.webrtc.DataChannel) = Unit
        override fun onRenegotiationNeeded() { emit("renegotiation-needed", JSONObject()) }
        override fun onAddTrack(receiver: RtpReceiver, streams: Array<out org.webrtc.MediaStream>) {
            handleRemoteTrack(receiver.track())
        }
        override fun onTrack(transceiver: org.webrtc.RtpTransceiver) {
            handleRemoteTrack(transceiver.receiver.track())
        }
    }

    @Synchronized
    private fun handleRemoteTrack(track: org.webrtc.MediaStreamTrack?) {
        when (track) {
            is VideoTrack -> {
                remoteVideoTrack?.let { old -> remoteVideoSink?.let(old::removeSink) }
                remoteVideoTrack = track
                remoteVideoSink?.let(track::addSink)
                emit("remote-video-track", JSONObject().put("id", track.id()))
            }
            is AudioTrack -> emit("remote-audio-track", JSONObject().put("id", track.id()))
        }
    }

    private fun parseIceServers(json: JSONArray): List<PeerConnection.IceServer> {
        val result = mutableListOf<PeerConnection.IceServer>()
        for (index in 0 until json.length()) {
            val item = json.optJSONObject(index) ?: continue
            val urls = item.opt("urls")
            val urlList = when (urls) {
                is JSONArray -> (0 until urls.length()).mapNotNull { urls.optString(it).takeIf(String::isNotBlank) }
                is String -> listOf(urls)
                else -> emptyList()
            }
            if (urlList.isEmpty()) continue
            val builder = PeerConnection.IceServer.builder(urlList)
            item.optString("username").takeIf { it.isNotBlank() }?.let(builder::setUsername)
            item.optString("credential").takeIf { it.isNotBlank() }?.let(builder::setPassword)
            result += builder.createIceServer()
        }
        if (result.isEmpty()) result += PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
        return result
    }

    @Synchronized
    fun close() {
        localVideoSink?.let { sink -> videoTrack?.removeSink(sink) }
        remoteVideoSink?.let { sink -> remoteVideoTrack?.removeSink(sink) }
        remoteVideoTrack = null
        try { cameraCapturer?.stopCapture() } catch (error: Exception) { Log.w(TAG, "Camera stop failed", error) }
        try { cameraCapturer?.dispose() } catch (_: Exception) { }
        cameraCapturer = null
        surfaceTextureHelper?.dispose()
        surfaceTextureHelper = null
        videoTrack?.dispose()
        videoTrack = null
        videoSource?.dispose()
        videoSource = null
        audioTrack?.dispose()
        audioTrack = null
        audioSource?.dispose()
        audioSource = null
        peerConnection?.close()
        peerConnection?.dispose()
        peerConnection = null
        emit("closed", JSONObject())
    }

    private fun emitError(stage: String, error: Throwable) {
        Log.e(TAG, "Native WebRTC $stage failed", error)
        emit("error", JSONObject().put("stage", stage).put("message", error.message ?: error.javaClass.simpleName))
    }

    fun dispose() {
        close()
        factory.dispose()
        eglBase.release()
    }

    companion object { private const val TAG = "TigerNativeWebRTC" }
}
