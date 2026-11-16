import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Palet warna Negeri Wkwk: malam ungu, emas, merah-putih, krem kayu.
class Palette {
  static const night = Color(0xFF170E2E);
  static const night2 = Color(0xFF3A1A52);
  static const gold = Color(0xFFFFC94D);
  static const goldDark = Color(0xFFB8860B);
  static const red = Color(0xFFE63946);
  static const green = Color(0xFF2DBE6C);
  static const blue = Color(0xFF3A86FF);
  static const cream = Color(0xFFFFF4DC);
  static const wood = Color(0xFF9C6B3C);
  static const woodDark = Color(0xFF5C3A1A);
  static const panel = Color(0x26FFFFFF);
  static const panelBorder = Color(0x33FFFFFF);
}

TextStyle titleFont({double size = 20, Color color = Colors.white, List<Shadow>? shadows}) =>
    GoogleFonts.lilitaOne(fontSize: size, color: color, shadows: shadows, height: 1.1);

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.fromSeed(
      seedColor: Palette.red,
      brightness: Brightness.dark,
    ).copyWith(primary: Palette.gold, onPrimary: Colors.black, secondary: Palette.red),
  );
  return base.copyWith(
    scaffoldBackgroundColor: Colors.transparent,
    textTheme: GoogleFonts.nunitoTextTheme(base.textTheme)
        .apply(bodyColor: Colors.white, displayColor: Colors.white),
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: titleFont(size: 22),
      foregroundColor: Colors.white,
    ),
    cardTheme: const CardThemeData(
      color: Palette.panel,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(16)),
        side: BorderSide(color: Palette.panelBorder),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: Color(0x1AFFFFFF),
      border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(14))),
    ),
  );
}

/// Latar belakang malam dengan gradasi dan titik-titik "bintang".
class GameBackground extends StatelessWidget {
  const GameBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Palette.night, Palette.night2, Color(0xFF5A1F3D)],
        ),
      ),
      child: CustomPaint(painter: _StarsPainter(), child: child),
    );
  }
}

class _StarsPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = const Color(0x33FFFFFF);
    // Pola tetap (bukan acak) supaya tidak berkedip saat rebuild.
    for (var i = 0; i < 70; i++) {
      final x = (i * 97 % 1000) / 1000 * size.width;
      final y = (i * 389 % 1000) / 1000 * size.height;
      canvas.drawCircle(Offset(x, y), (i % 3 + 1) * 0.6, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Tombol tebal ala game: ada "bayangan bawah" yang turun saat ditekan.
class GameButton extends StatefulWidget {
  const GameButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.color = Palette.gold,
    this.textColor = Colors.black,
    this.small = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final Color color;
  final Color textColor;
  final bool small;

  @override
  State<GameButton> createState() => _GameButtonState();
}

class _GameButtonState extends State<GameButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;
    final color = enabled ? widget.color : const Color(0xFF6B6478);
    final shadow = Color.lerp(color, Colors.black, 0.4)!;
    final depth = _down ? 1.0 : 4.0;
    return GestureDetector(
      onTapDown: enabled ? (_) => setState(() => _down = true) : null,
      onTapCancel: enabled ? () => setState(() => _down = false) : null,
      onTapUp: enabled
          ? (_) {
              setState(() => _down = false);
              widget.onPressed!();
            }
          : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 60),
        margin: EdgeInsets.only(top: 4 - depth),
        padding: EdgeInsets.symmetric(
          horizontal: widget.small ? 12 : 18,
          vertical: widget.small ? 8 : 12,
        ),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [BoxShadow(color: shadow, offset: Offset(0, depth))],
          border: Border.all(color: Colors.white24),
        ),
        child: Text(
          widget.label,
          style: titleFont(
            size: widget.small ? 14 : 16,
            color: enabled ? widget.textColor : Colors.white60,
          ),
        ),
      ),
    );
  }
}

/// Panel kaca gelap untuk informasi.
class Panel extends StatelessWidget {
  const Panel({super.key, required this.child, this.padding = const EdgeInsets.all(14)});

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: Palette.panel,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Palette.panelBorder),
      ),
      child: child,
    );
  }
}
