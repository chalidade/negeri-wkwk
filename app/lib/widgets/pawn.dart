import 'package:flutter/material.dart';

/// Pion berdiri: kepala bulat, badan mengembang, bayangan di bawah.
class Pawn extends StatelessWidget {
  const Pawn({super.key, required this.color, required this.size, this.emoji, this.glow = false});

  final Color color;
  final double size;
  final String? emoji;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size * 1.35,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          CustomPaint(size: Size(size, size * 1.35), painter: _PawnPainter(color, glow)),
          if (emoji != null)
            Positioned(
              top: size * 0.08,
              child: Text(emoji!, style: TextStyle(fontSize: size * 0.32)),
            ),
        ],
      ),
    );
  }
}

class _PawnPainter extends CustomPainter {
  _PawnPainter(this.color, this.glow);

  final Color color;
  final bool glow;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final light = Color.lerp(color, Colors.white, 0.45)!;
    final dark = Color.lerp(color, Colors.black, 0.35)!;

    // bayangan
    canvas.drawOval(
      Rect.fromCenter(center: Offset(w / 2, h * 0.94), width: w * 0.9, height: h * 0.14),
      Paint()..color = const Color(0x66000000),
    );
    if (glow) {
      canvas.drawOval(
        Rect.fromCenter(center: Offset(w / 2, h * 0.94), width: w * 1.25, height: h * 0.26),
        Paint()
          ..color = const Color(0x88FFC94D)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
      );
    }

    final body = Path()
      ..moveTo(w * 0.5, h * 0.36)
      ..cubicTo(w * 0.2, h * 0.5, w * 0.1, h * 0.8, w * 0.1, h * 0.88)
      ..quadraticBezierTo(w * 0.5, h * 0.98, w * 0.9, h * 0.88)
      ..cubicTo(w * 0.9, h * 0.8, w * 0.8, h * 0.5, w * 0.5, h * 0.36)
      ..close();
    final shader = LinearGradient(colors: [light, color, dark])
        .createShader(Rect.fromLTWH(0, 0, w, h));
    canvas.drawPath(body, Paint()..shader = shader);
    canvas.drawPath(
      body,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = Colors.white70,
    );

    final headC = Offset(w / 2, h * 0.27);
    final headR = w * 0.27;
    canvas.drawCircle(
      headC,
      headR,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-0.4, -0.5),
          colors: [light, color, dark],
        ).createShader(Rect.fromCircle(center: headC, radius: headR)),
    );
    canvas.drawCircle(
      headC,
      headR,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = Colors.white70,
    );
  }

  @override
  bool shouldRepaint(covariant _PawnPainter old) => old.color != color || old.glow != glow;
}
