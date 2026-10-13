"""
Generates the comprehensive SoundSense Architecture, ML, and Backend Guide PDF.
All table cells wrapped in Paragraphs for flawless text auto-wrapping.
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Adds page numbers and header/footer to each page."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#718096"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 11 * inch - 36, "SoundSense — End-to-End System Architecture & Technical Specification")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)
            
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 34, footer_text)
        self.drawString(54, 34, "Confidential & Proprietary — SoundSense Research Project")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 46, 8.5 * inch - 54, 46)
        
        self.restoreState()

def build_pdf(filename="SoundSense_Architecture_and_System_Guide.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_primary = colors.HexColor("#0F172A")    # Deep slate
    c_accent = colors.HexColor("#2563EB")     # Royal blue
    c_text = colors.HexColor("#334155")
    c_subtle = colors.HexColor("#64748B")
    c_bg_box = colors.HexColor("#F8FAFC")
    c_border = colors.HexColor("#CBD5E1")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=c_primary,
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=c_accent,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'CustomH1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=c_primary,
        spaceBefore=12,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'CustomH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=c_accent,
        spaceBefore=9,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_text,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'CustomBullet',
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3.5
    )

    th_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    td_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=c_text
    )

    td_bold = ParagraphStyle(
        'TableCellBold',
        parent=td_style,
        fontName='Helvetica-Bold',
        textColor=c_primary
    )

    story = []

    # ================= COVER / TITLE BLOCK =================
    story.append(Paragraph("SoundSense — Comprehensive System Guide", title_style))
    story.append(Paragraph("Complete Technical Blueprint: Signal Ingestion, YAMNet/Whisper ML, GCC-PHAT 360° DOA, WebSocket Streaming & Safety Engine", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_accent, spaceAfter=10))

    # Meta Info Card
    meta_data = [
        [
            Paragraph("<b>Author / Project:</b> SoundSense Research Team", body_style),
            Paragraph("<b>Target Device:</b> Standalone Smartphone (Samsung S23 FE / Mobile Web)", body_style)
        ],
        [
            Paragraph("<b>Backend Stack:</b> Python FastAPI, WebSocket, SciPy, NumPy", body_style),
            Paragraph("<b>ML Models:</b> Google YAMNet (AudioSet), OpenAI Whisper ASR", body_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[3.6 * inch, 3.6 * inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_bg_box),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # ================= SECTION 1: EXECUTIVE SUMMARY =================
    story.append(Paragraph("1. Executive Summary & Core Philosophy", h1_style))
    story.append(Paragraph(
        "<b>SoundSense</b> is an end-to-end assistive sensory substitution system engineered specifically for deaf and hard-of-hearing individuals. "
        "Unlike legacy assistive tools that require dedicated external multi-microphone hardware arrays or companion smartwatches, SoundSense turns a "
        "<b>standard smartphone</b> into an all-in-one assistive acoustic radar. The system continuously listens to environmental soundwaves, classifies acoustic hazards, "
        "transcribes live speech, estimates 360° spatial direction-of-arrival (DOA), evaluates situational danger scores, and presents life-saving sensory alerts via visual radar and haptic vibrations.",
        body_style
    ))
    story.append(Paragraph(
        "<b>The 3-Second Elevator Pitch:</b> <i>'SoundSense transforms your mobile phone into an AI-powered acoustic radar. It captures ambient sound, routes it through deep learning models for classification and speech transcription, pinpoints the 360° direction of the noise using phase correlation and chassis diffraction, and triggers instant visual and haptic alerts if you are in danger.'</i>",
        body_style
    ))

    # ================= SECTION 2: ARCHITECTURE PIPELINE =================
    story.append(Paragraph("2. High-Level Architectural Flow", h1_style))
    story.append(Paragraph(
        "The architecture is organized as a high-throughput, low-latency client-server pipeline designed for sub-250ms reaction times:",
        body_style
    ))

    raw_steps = [
        ("Phase", "Component", "Function & Technical Mechanism"),
        ("1. Capture", "Mobile Web Audio API", "Captures 48 kHz stereo PCM audio via dual-channel MediaStreamSource & ScriptProcessor; accumulates ~250ms chunks (12,288 samples)."),
        ("2. Transport", "WebSocket (/ws/audio-stream)", "Streams interleaved 16-bit PCM (base64-encoded) over persistent low-latency full-duplex WebSocket connection."),
        ("3. Preprocess", "FastAPI AudioPreprocessor", "Decodes PCM; applies 4th-order Butterworth High-Pass filter (80 Hz cutoff); computes RMS amplitude and calibrated dB SPL."),
        ("4. Ingestion", "Dual-Stage RMS Gate", "Switches between 16 kHz low-power idle mode and 48 kHz active inference mode to prevent server compute saturation."),
        ("5. ML Routing", "YAMNet Classifier", "Resamples to 16 kHz; computes 64-band log-mel spectrogram; classifies into 521 AudioSet categories; routes to Branch A (Speech) or Branch B (Acoustic Hazard)."),
        ("6. Branch A", "Whisper Speech ASR", "If speech/shout detected: executes Whisper transformer for real-time natural language speech-to-text transcription."),
        ("7. Branch B", "GCC-PHAT 360° DOA Engine", "Cross-Power Spectrum with PHAT whitening computes TDOA (τ); resolves front/back cone-of-confusion using chassis diffraction index."),
        ("8. Safety", "DangerEngine & Hysteresis", "Calculates composite Hazard Score D in [0, 100]; applies 3s cooldown & 1.5s hysteresis; triggers 10s SOS countdown if D >= 90."),
        ("9. Presentation", "360° Radar Compass UI", "Presents direction needle, priority badges (P0/P1/P2/P3), live dB SPL metering, haptic patterns, and live transcripts.")
    ]
    
    t_pipe_data = []
    for i, (p, c, desc) in enumerate(raw_steps):
        if i == 0:
            t_pipe_data.append([Paragraph(p, th_style), Paragraph(c, th_style), Paragraph(desc, th_style)])
        else:
            t_pipe_data.append([Paragraph(p, td_bold), Paragraph(c, td_style), Paragraph(desc, td_style)])

    t_pipe = Table(t_pipe_data, colWidths=[0.9 * inch, 1.7 * inch, 4.6 * inch])
    t_pipe.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_box]),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_pipe)
    story.append(Spacer(1, 8))

    # ================= SECTION 3: MACHINE LEARNING DEEP DIVE =================
    story.append(Paragraph("3. Machine Learning Models & Inference Pipeline", h1_style))
    story.append(Paragraph(
        "SoundSense utilizes a dual-model artificial intelligence architecture to separate speech comprehension from environmental situational awareness:",
        body_style
    ))
    
    story.append(Paragraph("3.1 YAMNet (Acoustic Scene & Event Classifier)", h2_style))
    story.append(Paragraph(
        "<b>Model Architecture:</b> YAMNet is a lightweight deep convolutional neural network based on the <b>MobileNet-v1</b> architecture, specifically optimized for edge and mobile deployment. "
        "It employs depthwise separable convolutions that decouple spatial filtering from channel-wise feature mixing, slashing parameter count by over 80% compared to standard ResNet/VGG architectures.",
        body_style
    ))
    story.append(Paragraph("<b>Input Representation:</b> 16 kHz mono waveform is sliced into 25 ms Hann-windowed frames with a 10 ms hop size. A 64-band log-mel spectrogram is computed across the 125 Hz – 7500 Hz frequency range, mimicking human cochlear frequency sensitivity.", bullet_style))
    story.append(Paragraph("<b>Acoustic Ontology & Routing:</b> YAMNet produces softmax probabilities across 521 AudioSet classes. SoundSense maps these into an assistive ontology of 37 critical categories with predefined severity ratings (P0 Critical, P1 Caution, P2 Awareness, P3 Informational).", bullet_style))
    story.append(Paragraph("<b>Confidence Gating:</b> The orchestrator enforces a 70% confidence threshold (C >= 0.70) to suppress environmental false alarms while maintaining high recall on critical alerts (sirens, car horns, dog barks, fire alarms).", bullet_style))

    story.append(Paragraph("3.2 OpenAI Whisper (Natural Language ASR)", h2_style))
    story.append(Paragraph(
        "When YAMNet flags that the incoming sound belongs to human vocalization (speech, screaming, shouting, crowd chatter), the pipeline routes the audio to <b>Branch A (Whisper ASR)</b>. "
        "Whisper is an encoder-decoder transformer trained on 680,000 hours of multilingual, acoustically diverse audio. "
        "It performs noise-robust speech recognition, outputting transcription text, speaker confidence, and finality tokens to the mobile UI in real-time, allowing deaf users to read public transit announcements or shouted warnings instantly.",
        body_style
    ))

    # ================= SECTION 4: SPATIAL AUDIO & GCC-PHAT =================
    story.append(Paragraph("4. Spatial Audio Localization & 360° GCC-PHAT Engine", h1_style))
    story.append(Paragraph(
        "To tell a deaf user <i>where</i> a danger is approaching from, SoundSense implements physical <b>Time Difference of Arrival (TDOA)</b> estimation using the <b>Generalized Cross-Correlation with Phase Transform (GCC-PHAT)</b> algorithm.",
        body_style
    ))

    story.append(Paragraph("4.1 Mathematical Formulation of GCC-PHAT", h2_style))
    story.append(Paragraph(
        "Given Left channel signal x_L(t) and Right channel signal x_R(t) recorded at sample rate f_s = 48 kHz with physical microphone spacing d = 0.14 m and speed of sound c = 343 m/s:",
        body_style
    ))
    story.append(Paragraph("<b>1. Discrete Fourier Transforms:</b> X_L(f) = FFT(x_L) and X_R(f) = FFT(x_R)", bullet_style))
    story.append(Paragraph("<b>2. Cross-Power Spectrum:</b> G_RL(f) = X_R(f) · conj(X_L(f))", bullet_style))
    story.append(Paragraph("<b>3. PHAT Whitening Transform:</b> ψ(f) = G_RL(f) / (|G_RL(f)| + ε). This equalizes frequency magnitudes, stripping acoustic room reverberation and keeping only pure phase differences.", bullet_style))
    story.append(Paragraph("<b>4. Inverse FFT:</b> cc(τ) = IFFT(ψ(f)). The peak lag n_peak = argmax(cc(τ)) corresponds to the inter-channel delay in sample counts.", bullet_style))
    story.append(Paragraph("<b>5. TDOA & Angular Arrival:</b> τ = n_peak / f_s. The acoustic angle θ = arccos( -c · τ / d ).", bullet_style))

    story.append(Paragraph("4.2 Resolving the Front-vs-Back 'Cone of Confusion'", h2_style))
    story.append(Paragraph(
        "A fundamental limitation of two collinear microphones is the <b>Cone of Confusion</b>: a sound in Front (Ahead, 90°) and a sound directly Behind (Back, 270°) both produce identical zero delay (τ = 0). "
        "SoundSense solves this physical ambiguity through <b>Chassis Acoustic Diffraction & Spectral Shadowing Analysis</b>:",
        body_style
    ))
    story.append(Paragraph("<b>Phone Chassis Obstacle:</b> A smartphone body (glass back, internal battery, metal chassis) acts as an acoustic barrier for sounds coming from behind the phone.", bullet_style))
    story.append(Paragraph("<b>High-Frequency Shadowing:</b> High frequencies (> 3.5 kHz, wavelength < 10 cm) cannot wrap around the phone chassis without undergoing substantial diffraction loss (6 dB to 12 dB drop). Conversely, low/mid frequencies (500 Hz - 2.5 kHz) diffract easily.", bullet_style))
    story.append(Paragraph("<b>Diffraction Ratio Metric:</b> The orchestrator calculates the ratio R = E_high / E_mid. If R < 0.085, the sound source is classified in the <b>Rear Hemisphere</b>, reflecting the angle across the horizontal axis: θ_rear = 360° - θ_front. This enables true 360° localization: South (270°), South-West (225°), and South-East (315°).", bullet_style))

    # ================= SECTION 5: SAFETY & DANGER ENGINE =================
    story.append(Paragraph("5. Safety Assessment & Emergency SOS Engine", h1_style))
    story.append(Paragraph(
        "Raw sound classification is not enough — a siren 2 blocks away is awareness, but a car horn 2 meters away is life-threatening. "
        "The <b>DangerEngine</b> evaluates urgency through dynamic scoring, temporal hysteresis, and automated incident escalation:",
        body_style
    ))
    story.append(Paragraph("<b>Composite Danger Score:</b> D = w_base · S_type + w_vol · f(dB_SPL) + w_conf · C + w_ctx · Context. Scores range from 0 to 100 and map to 4 danger tiers: <b>SAFE (0-39)</b>, <b>AWARENESS (40-69)</b>, <b>CAUTION (70-89)</b>, and <b>DANGER (90-100)</b>.", bullet_style))
    story.append(Paragraph("<b>Temporal Hysteresis & Cooldown:</b> To prevent rapid alert flickering, alerts require a cooldown of 3.0s per category, and danger score de-escalation requires a 1.5s delay with a -15 point drop.", bullet_style))
    story.append(Paragraph("<b>Automated SOS Trigger:</b> If a critical danger state (D >= 90) is sustained for 10 consecutive seconds without manual dismissal, an automated 10-second SOS countdown is triggered, notifying emergency contacts and logging the incident.", bullet_style))

    # ================= SECTION 6: WEBSOCKET PROTOCOL =================
    story.append(Paragraph("6. Full-Duplex WebSocket Protocol & Streaming", h1_style))
    story.append(Paragraph(
        "Communication runs over a bidirectional WebSocket endpoint at <code>/ws/audio-stream</code>. "
        "Unlike REST polling, WebSockets eliminate HTTP handshake overhead and enable true real-time sub-100ms bidirectional event streaming:",
        body_style
    ))

    raw_ws = [
        ("Direction", "Message Type", "Payload Attributes", "Description"),
        ("Client -> Server", "audio_chunk", "data (base64 PCM), fs (48k), channels (2), seq", "Continuously streams 250ms interleaved 16-bit stereo PCM audio."),
        ("Client -> Server", "synthetic_trigger", "sound_class, delay_samples, db_spl, is_rear", "Simulator trigger for testing directional angles without hardware."),
        ("Client -> Server", "config_update", "rms_threshold, mic_spacing_m, context_score", "Updates client sensitivity and acoustic calibration thresholds."),
        ("Server -> Client", "connected", "session_id, server_time, message", "Handshake confirmation establishing active audio session."),
        ("Server -> Client", "status", "state (active/idle), rms, db_spl, timestamp", "Live RMS amplitude and dB SPL metering emitted every 250ms."),
        ("Server -> Client", "sound_event", "class, display_name, angle_deg, compass_zone, priority", "Emitted when classified hazard meets confidence and cooldown gates."),
        ("Server -> Client", "transcription", "text, speaker, confidence, is_final", "Emitted when Whisper ASR transcribes human speech / announcements."),
        ("Server -> Client", "danger_update", "score (0-100), level, factors, sos_auto_triggered", "Real-time safety assessment update driving UI gauge & warnings.")
    ]
    t_ws_data = []
    for i, (d, m, p, desc) in enumerate(raw_ws):
        if i == 0:
            t_ws_data.append([Paragraph(d, th_style), Paragraph(m, th_style), Paragraph(p, th_style), Paragraph(desc, th_style)])
        else:
            t_ws_data.append([Paragraph(d, td_bold), Paragraph(m, td_style), Paragraph(p, td_style), Paragraph(desc, td_style)])

    t_ws = Table(t_ws_data, colWidths=[1.1 * inch, 1.2 * inch, 2.3 * inch, 2.6 * inch])
    t_ws.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_box]),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_ws)
    story.append(Spacer(1, 8))

    # ================= SECTION 7: INTERVIEW / EXPLANATION CHEATSHEET =================
    story.append(Paragraph("7. How to Explain SoundSense (Presentation Guide)", h1_style))
    story.append(Paragraph(
        "Use this structured talking track when explaining SoundSense to recruiters, professors, or hackathon judges:",
        body_style
    ))

    story.append(Paragraph("<b>Q: What makes SoundSense novel compared to existing sound recognition apps?</b><br/>"
                           "<i>A: Standard accessibility apps only do mono sound classification — they say 'a horn honked', but can't tell you where it came from. SoundSense provides real-time 360° spatial localization using GCC-PHAT and chassis diffraction on a standard smartphone, plus an intelligent danger evaluation engine that prevents alert fatigue through hysteresis and auto-triggers emergency SOS if high hazard persists.</i>", body_style))

    story.append(Paragraph("<b>Q: How does direction detection work on a phone without an external mic array?</b><br/>"
                           "<i>A: Smartphones like the Samsung S23 FE possess top and bottom microphones spaced ~14cm apart. When held in landscape mode, sound hits one microphone before the other. We apply GCC-PHAT to compute the cross-power spectrum and inverse Fourier transform to find the inter-channel delay (τ). To resolve front versus back ambiguity, our algorithm evaluates high-frequency diffraction shadowing caused by the phone's physical chassis.</i>", body_style))

    story.append(Paragraph("<b>Q: How do you handle low-latency streaming without draining battery?</b><br/>"
                           "<i>A: We use a dual-stage ingestion architecture. When ambient acoustics are quiet, the system operates in a low-power 16 kHz idle monitoring mode. Only when an acoustic surge exceeds the calibrated RMS threshold does the system transition to 48 kHz active inference. We batch audio into ~250ms chunks streamed over persistent WebSockets, keeping round-trip latency under 300ms while eliminating HTTP polling overhead.</i>", body_style))

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=c_border, spaceAfter=6))
    story.append(Paragraph("<b>SoundSense Assistive System</b> — Developed with Python, FastAPI, YAMNet, Whisper & Web Audio API.", ParagraphStyle('Foot', parent=body_style, fontSize=7.5, textColor=c_subtle, alignment=1)))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[PDF] Successfully built {filename}")

if __name__ == "__main__":
    build_pdf()
