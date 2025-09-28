@RestController
@RequestMapping("/api")
public class HealthController {

    @GetMapping("/hello")
    public String hello() {
        return "Backend is alive!";
    }
}
