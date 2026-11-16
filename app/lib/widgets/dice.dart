import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Sepasang dadu 3D yang berguling setiap nilainya berubah.
class DicePair extends StatefulWidget {
  const DicePair({super.key, required this.values, required this.size});

  final List<int>? values;
  final double size;

  @override
  State<DicePair> createState() => _DicePairState();
}

class _DicePairState extends State<DicePair> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  final _rnd = math.Random();

  @override
  void didUpdateWidget(covariant DicePair oldWidget) {
    super.didUpdateWidget(oldWidget);
    final a = oldWidget.values;
    final b = widget.values;
    final changed = b != null &&
        (a == null || a.length != b.length || a[0] != b[0] || a[1] != b[1]);
    if (changed) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final values = widget.values;
    if (values == null || values.length != 2) return const SizedBox.shrink();
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = Curves.easeOutCubic.transform(_c.value);
        final rolling = _c.isAnimating;
        Widget die(int i) {
          final face = rolling && t < 0.85 ? _rnd.nextInt(6) + 1 : values[i];
          final dir = i == 0 ? 1.0 : -1.0;
          final angle = (1 - t) * math.pi * 3 * dir;
          final hop = math.sin(t * math.pi) * widget.size * 0.6;
          return Transform.translate(
            offset: Offset(0, -hop),
            child: Transform.rotate(
              angle: angle,
              child: Die3D(value: face, size: widget.size),
            ),
          );
        }

        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [die(0), SizedBox(width: widget.size * 0.35), die(1)],
        );
      },
    );
  }
}

/// Satu dadu dengan sisi samping gelap supaya terlihat seperti kubus.
class Die3D extends StatelessWidget {
  const Die3D({super.key, required this.value, required this.size});

  final int value;
  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(size: Size.square(size), painter: _DiePainter(value));
  }
}

class _DiePainter extends CustomPainter {
  _DiePainter(this.value);

  final int value;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final depth = s * 0.12;
    final r = Radius.circular(s * 0.18);
    final face = RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, s - depth, s - depth), r);

    // bayangan di lantai
    canvas.drawOval(
      Rect.fromLTWH(s * 0.05, s * 0.85, s * 0.95, s * 0.22),
      Paint()..color = const Color(0x55000000),
    );
    // sisi samping (kubus)
    canvas.drawRRect(face.shift(Offset(depth, depth)), Paint()..color = const Color(0xFFB9B2C9));
    canvas.drawRRect(face.shift(Offset(depth * 0.5, depth * 0.5)), Paint()..color = const Color(0xFFD9D3E6));
    // muka depan
    canvas.drawRRect(
      face,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.white, Color(0xFFF1ECF7)],
        ).createShader(face.outerRect),
    );

    final f = s - depth;
    final pip = Paint()..color = value == 1 ? const Color(0xFFE63946) : const Color(0xFF1B1035);
    final pr = f * (value == 1 ? 0.13 : 0.09);
    const a = 0.27, b = 0.5, c = 0.73;
    final spots = <List<double>>[
      [],
      [b, b],
      [a, a, c, c],
      [a, a, b, b, c, c],
      [a, a, c, a, a, c, c, c],
      [a, a, c, a, b, b, a, c, c, c],
      [a, a, c, a, a, b, c, b, a, c, c, c],
    ][value.clamp(1, 6)];
    for (var i = 0; i < spots.length; i += 2) {
      canvas.drawCircle(Offset(spots[i] * f, spots[i + 1] * f), pr, pip);
    }
  }

  @override
  bool shouldRepaint(covariant _DiePainter oldDelegate) => oldDelegate.value != value;
}
